#!/usr/bin/env node
// Stage 4 — apply the transformed residents to a target Supabase project.
//
// Usage:
//   node scripts/import-residents/04-import.mjs --target=dev   [--dry-run] [--limit=N]
//   node scripts/import-residents/04-import.mjs --target=prod  [--dry-run] [--limit=N]
//
// Behaviour:
//   - Reads scripts/import-residents/reports/03-transformed.json
//   - Connects to Supabase using SERVICE ROLE KEY (bypasses RLS)
//     - dev:  reads .env.development.local
//     - prod: reads .env.local
//   - Idempotent on residents: skips any existing row whose national_id_or_iqama
//     already matches; falls back to phone if id missing.
//   - Idempotent on apartments: matched by (building_id, apartment_number)
//   - Idempotent on rooms: matched by (apartment_id, room_number)
//   - Idempotent on room_assignments: matched by (resident_id, room_id, check_in_date)
//   - Auto-created apartments are created with is_active=false (hidden on public
//     site) and a "[Auto-created from CSV import]" note so managers spot them.
//   - Writes a post-import audit to reports/04-audit-<target>.txt.
//
// Refuses to run against prod unless --confirm-prod is explicitly passed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const TRANSFORMED_PATH = path.join(__dirname, 'reports', '03-transformed.json');

const PROD_PROJECT_REF = 'xvcpyofwhmuohpvinrry';
const DEV_PROJECT_REF = 'xswagpwarqfdlbtkhlgz';

// --- arg parsing ----------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const target = args.target;
const dryRun = !!args['dry-run'];
const limit = args.limit ? +args.limit : null;
const confirmProd = !!args['confirm-prod'];

if (!target || (target !== 'dev' && target !== 'prod')) {
  console.error('Error: --target=dev or --target=prod required');
  process.exit(2);
}
if (target === 'prod' && !confirmProd) {
  console.error('Error: --confirm-prod required to run against production.');
  console.error('       Run against dev first, verify, then re-run with --confirm-prod.');
  process.exit(2);
}

// --- env loading ----------------------------------------------------------
function loadEnv(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) {
    console.error(`Error: ${file} not found at ${p}`);
    process.exit(2);
  }
  const text = fs.readFileSync(p, 'utf8');
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const envFile = target === 'prod' ? '.env.local' : '.env.development.local';
const env = loadEnv(envFile);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(`Error: ${envFile} missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
  process.exit(2);
}

const expectedRef = target === 'prod' ? PROD_PROJECT_REF : DEV_PROJECT_REF;
if (!SUPABASE_URL.includes(expectedRef)) {
  console.error(`Error: ${envFile} URL does not match expected ${target} project ref ${expectedRef}.`);
  console.error(`URL: ${SUPABASE_URL}`);
  process.exit(2);
}

console.log(`→ target:    ${target}`);
console.log(`→ project:   ${expectedRef}`);
console.log(`→ dry-run:   ${dryRun}`);
console.log(`→ limit:     ${limit ?? 'all'}`);
console.log('');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// --- helpers --------------------------------------------------------------
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function inferFloor(apartmentNumber) {
  const m = apartmentNumber.match(/^(\d+)/);
  if (!m) return 1;
  const num = +m[1];
  if (num >= 1000) return Math.floor(num / 100); // 1004 → floor 10
  if (num >= 100) return Math.floor(num / 100);  // 504 → floor 5
  return 1;                                       // "27", "11", "B6" → floor 1
}

function applyLimit(arr, n) {
  if (!n) return arr;
  return arr.slice(0, n);
}

// --- load transformed -----------------------------------------------------
if (!fs.existsSync(TRANSFORMED_PATH)) {
  console.error('Error: 03-transformed.json missing. Run 03-transform.mjs first.');
  process.exit(2);
}
const transformed = JSON.parse(fs.readFileSync(TRANSFORMED_PATH, 'utf8'));
let residents = transformed.residents;
console.log(`Loaded ${residents.length.toLocaleString()} residents from transform output.`);

if (limit) {
  residents = applyLimit(residents, limit);
  console.log(`(--limit applied: processing first ${residents.length.toLocaleString()})`);
}

// --- step 1: lookup existing residents ------------------------------------
console.log('');
console.log('Step 1/5 — fetching existing residents from target DB…');

// Paginate — Supabase caps at 1,000 rows per query.
const existingResidents = [];
{
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('residents')
      .select('id, national_id_or_iqama, phone')
      .range(from, from + pageSize - 1);
    if (error) {
      console.error('Failed to fetch existing residents:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    existingResidents.push(...data);
    if (data.length < pageSize) break;
  }
}

const existingByKey = new Map();
for (const r of existingResidents || []) {
  if (r.national_id_or_iqama) existingByKey.set(r.national_id_or_iqama, r.id);
  if (r.phone) existingByKey.set(`phone:${r.phone}`, r.id);
}
console.log(`  ${(existingResidents || []).length.toLocaleString()} existing residents in DB.`);

// --- step 2: insert new residents -----------------------------------------
console.log('');
console.log('Step 2/5 — inserting new residents…');

const toInsert = [];
const skipExisting = [];
for (const r of residents) {
  const key = r.national_id_or_iqama || (r.phone ? `phone:${r.phone}` : null);
  if (key && existingByKey.has(key)) {
    skipExisting.push({ key, existingId: existingByKey.get(key) });
    continue;
  }
  toInsert.push({
    full_name: r.full_name.slice(0, 200),
    phone: r.phone || '0000000000', // schema requires NOT NULL; placeholder for missing
    email: r.email,
    national_id_or_iqama: r.national_id_or_iqama,
    nationality: r.nationality,
    date_of_birth: r.date_of_birth,
    university_or_workplace: r.university_or_workplace ? r.university_or_workplace.slice(0, 500) : null,
    emergency_contact_name: r.emergency_contact_name,
    emergency_contact_phone: r.emergency_contact_phone,
    profile_image: r.profile_image,
    documents: r.documents || [],
    status: r.status,
    notes: r.notes,
  });
}

console.log(`  to insert: ${toInsert.length.toLocaleString()}`);
console.log(`  to skip (already exist): ${skipExisting.length.toLocaleString()}`);

const insertedKeyToId = new Map(); // key → resident_id (for assignment FK lookup)

if (!dryRun && toInsert.length > 0) {
  const batches = chunk(toInsert, 200);
  let done = 0;
  for (const [bi, batch] of batches.entries()) {
    const { data, error } = await supabase
      .from('residents')
      .insert(batch)
      .select('id, national_id_or_iqama, phone');
    if (error) {
      console.error(`  Batch ${bi + 1}/${batches.length} failed:`, error);
      process.exit(1);
    }
    for (const row of data || []) {
      if (row.national_id_or_iqama) insertedKeyToId.set(row.national_id_or_iqama, row.id);
      if (row.phone) insertedKeyToId.set(`phone:${row.phone}`, row.id);
    }
    done += batch.length;
    process.stdout.write(`\r  inserted: ${done}/${toInsert.length}`);
  }
  process.stdout.write('\n');
} else if (dryRun) {
  console.log('  [dry-run] skipped insert. assigning fake ids.');
  for (let i = 0; i < toInsert.length; i++) {
    const r = toInsert[i];
    const key = r.national_id_or_iqama || (r.phone ? `phone:${r.phone}` : `idx:${i}`);
    insertedKeyToId.set(key, `dryrun-${i}`);
  }
}

// Build full key→id map (existing + newly inserted)
const allKeyToId = new Map();
for (const [k, v] of existingByKey) allKeyToId.set(k, v);
for (const [k, v] of insertedKeyToId) allKeyToId.set(k, v);

// --- step 3: process eligible stays for room_assignments ------------------
console.log('');
console.log('Step 3/5 — processing eligible stays (apartment + room + non-ambiguous building)…');

const eligibleStays = [];
for (const r of residents) {
  const key = r.national_id_or_iqama || (r.phone ? `phone:${r.phone}` : null);
  const residentId = allKeyToId.get(key);
  if (!residentId) continue;
  for (const s of r.stays) {
    if (s.apartment && s.room && s.building_id) {
      eligibleStays.push({
        residentId,
        residentKey: key,
        residentStatus: r.status,
        isMostRecent: s.is_most_recent,
        building_id: s.building_id,
        apartment_number: String(s.apartment),
        room_number: String(s.room),
        unit_spec: s.unit_spec,
        unit_type_str: s.unit_type_str,
        check_in_date: s.parsed_check_in || s.contract_start || null,
        ejar_end: s.ejar_end,
        supervisor_comment: s.supervisor_comment,
      });
    }
  }
}
console.log(`  eligible stays: ${eligibleStays.length.toLocaleString()}`);

// --- step 3a: ensure apartments exist -------------------------------------
const apartmentKeys = new Map(); // "buildingId|aptNum" → { building_id, apartment_number, floor, ...}
for (const s of eligibleStays) {
  const k = `${s.building_id}|${s.apartment_number}`;
  if (!apartmentKeys.has(k)) {
    apartmentKeys.set(k, {
      building_id: s.building_id,
      apartment_number: s.apartment_number,
    });
  }
}

console.log('');
console.log(`Step 3a/5 — ensuring ${apartmentKeys.size} unique apartments exist…`);

const aptKeyToId = new Map();
let apartmentsCreatedCount = 0;
{
  // bulk fetch existing apartments
  const buildingIds = [...new Set([...apartmentKeys.values()].map((a) => a.building_id))];
  if (buildingIds.length > 0) {
    const { data: existing, error } = await supabase
      .from('apartments')
      .select('id, building_id, apartment_number')
      .in('building_id', buildingIds);
    if (error) {
      console.error('Failed to fetch apartments:', error);
      process.exit(1);
    }
    for (const a of existing || []) {
      aptKeyToId.set(`${a.building_id}|${a.apartment_number}`, a.id);
    }
  }

  const toInsertApts = [];
  for (const [k, a] of apartmentKeys) {
    if (!aptKeyToId.has(k)) {
      toInsertApts.push({
        building_id: a.building_id,
        apartment_number: a.apartment_number,
        floor: inferFloor(a.apartment_number),
        notes: '[Auto-created from CSV import 2026-05-04. Verify floor and details.]',
        is_active: false,
      });
    }
  }
  console.log(`  existing: ${aptKeyToId.size}, to create: ${toInsertApts.length}`);
  apartmentsCreatedCount = toInsertApts.length;

  if (!dryRun && toInsertApts.length > 0) {
    const batches = chunk(toInsertApts, 100);
    for (const batch of batches) {
      const { data, error } = await supabase
        .from('apartments')
        .insert(batch)
        .select('id, building_id, apartment_number');
      if (error) {
        console.error('Apartment insert failed:', error);
        process.exit(1);
      }
      for (const row of data || []) {
        aptKeyToId.set(`${row.building_id}|${row.apartment_number}`, row.id);
      }
    }
  } else if (dryRun) {
    for (const a of toInsertApts) {
      aptKeyToId.set(`${a.building_id}|${a.apartment_number}`, `dryrun-apt-${aptKeyToId.size}`);
    }
  }
}

// --- step 3b: ensure rooms exist ------------------------------------------
const roomKeys = new Map(); // "aptId|roomNum" → spec
for (const s of eligibleStays) {
  const aptId = aptKeyToId.get(`${s.building_id}|${s.apartment_number}`);
  if (!aptId) continue;
  const k = `${aptId}|${s.room_number}`;
  if (!roomKeys.has(k)) {
    roomKeys.set(k, {
      apartment_id: aptId,
      building_id: s.building_id,
      room_number: s.room_number,
      unit_spec: s.unit_spec,
      unit_type_str: s.unit_type_str,
      supervisor_comment: s.supervisor_comment,
    });
  }
}

console.log('');
console.log(`Step 3b/5 — ensuring ${roomKeys.size} unique rooms exist…`);

const roomKeyToId = new Map();
let roomsCreatedCount = 0;
{
  const aptIds = [...new Set([...roomKeys.values()].map((r) => r.apartment_id))].filter(
    (x) => !String(x).startsWith('dryrun-')
  );
  if (aptIds.length > 0) {
    const { data: existing, error } = await supabase
      .from('rooms')
      .select('id, apartment_id, room_number')
      .in('apartment_id', aptIds);
    if (error) {
      console.error('Failed to fetch rooms:', error);
      process.exit(1);
    }
    for (const r of existing || []) {
      if (r.room_number) {
        roomKeyToId.set(`${r.apartment_id}|${r.room_number}`, r.id);
      }
    }
  }

  const toInsertRooms = [];
  for (const [k, r] of roomKeys) {
    if (!roomKeyToId.has(k)) {
      const spec = r.unit_spec;
      const roomType = spec?.room_type || 'single';
      const bathroomType = spec?.bathroom_type || 'private';
      const occupancyMode = spec?.occupancy_mode || 'private';
      const capacity = spec?.capacity || 1;
      toInsertRooms.push({
        building_id: r.building_id,
        apartment_id: r.apartment_id,
        room_number: r.room_number,
        room_type: roomType,
        bathroom_type: bathroomType,
        monthly_price: 0, // sentinel — manager edits
        occupancy_mode: occupancyMode,
        capacity,
        status: 'occupied',
        notes: `[Auto-created from CSV import 2026-05-04. Verify type/price.] CSV unit type: ${r.unit_type_str || '—'}`,
      });
    }
  }
  console.log(`  existing: ${roomKeyToId.size}, to create: ${toInsertRooms.length}`);
  roomsCreatedCount = toInsertRooms.length;

  if (!dryRun && toInsertRooms.length > 0) {
    const batches = chunk(toInsertRooms, 100);
    for (const batch of batches) {
      const { data, error } = await supabase
        .from('rooms')
        .insert(batch)
        .select('id, apartment_id, room_number');
      if (error) {
        console.error('Room insert failed:', error);
        process.exit(1);
      }
      for (const row of data || []) {
        if (row.room_number) {
          roomKeyToId.set(`${row.apartment_id}|${row.room_number}`, row.id);
        }
      }
    }
  } else if (dryRun) {
    for (const r of toInsertRooms) {
      roomKeyToId.set(`${r.apartment_id}|${r.room_number}`, `dryrun-room-${roomKeyToId.size}`);
    }
  }
}

// --- step 4: insert room_assignments --------------------------------------
console.log('');
console.log('Step 4/5 — inserting room_assignments…');

// Fetch existing assignments for our residents to avoid duplicates
const residentIds = [...new Set(eligibleStays.map((s) => s.residentId))].filter(
  (x) => !String(x).startsWith('dryrun-')
);
const existingAssignments = new Set();
if (residentIds.length > 0 && !dryRun) {
  const { data, error } = await supabase
    .from('room_assignments')
    .select('resident_id, room_id, check_in_date')
    .in('resident_id', residentIds);
  if (error) {
    console.error('Failed to fetch existing assignments:', error);
    process.exit(1);
  }
  for (const a of data || []) {
    existingAssignments.add(`${a.resident_id}|${a.room_id}|${a.check_in_date}`);
  }
}

const toInsertAssignments = [];
for (const s of eligibleStays) {
  const aptId = aptKeyToId.get(`${s.building_id}|${s.apartment_number}`);
  const roomId = roomKeyToId.get(`${aptId}|${s.room_number}`);
  if (!roomId) continue;
  if (!s.check_in_date) continue; // assignments need check_in_date

  // Status: only the most-recent stay of an active resident gets 'active'
  const assignmentStatus = (s.isMostRecent && s.residentStatus === 'active') ? 'active' : 'ended';
  // For ended assignments, use ejar_end as check_out if past, else null
  let checkOut = null;
  if (assignmentStatus === 'ended') {
    if (s.ejar_end) checkOut = s.ejar_end;
  }

  const dedupKey = `${s.residentId}|${roomId}|${s.check_in_date}`;
  if (existingAssignments.has(dedupKey)) continue;
  existingAssignments.add(dedupKey);

  toInsertAssignments.push({
    resident_id: s.residentId,
    room_id: roomId,
    building_id: s.building_id,
    check_in_date: s.check_in_date,
    check_out_date: checkOut,
    status: assignmentStatus,
  });
}

console.log(`  to insert: ${toInsertAssignments.length}`);

let assignmentsInserted = 0;
const assignmentsFailed = [];   // { reason, payload }

if (!dryRun && toInsertAssignments.length > 0) {
  // Insert ENDED assignments in batches first (no capacity trigger fires).
  // Then insert ACTIVE assignments one-at-a-time so a capacity violation on
  // one row doesn't kill the whole batch — we record failures and continue.
  const ended = toInsertAssignments.filter((a) => a.status === 'ended');
  const active = toInsertAssignments.filter((a) => a.status === 'active');

  // bulk-insert ended
  for (const batch of chunk(ended, 200)) {
    const { data, error } = await supabase
      .from('room_assignments')
      .insert(batch)
      .select('id');
    if (error) {
      console.error('Ended-assignment batch failed (continuing per-row):', error.message);
      // fall back to per-row for this batch
      for (const a of batch) {
        const { data: d2, error: e2 } = await supabase
          .from('room_assignments')
          .insert([a])
          .select('id');
        if (e2) assignmentsFailed.push({ reason: e2.message, payload: a });
        else assignmentsInserted += (d2 || []).length;
      }
    } else {
      assignmentsInserted += (data || []).length;
    }
    process.stdout.write(`\r  inserted: ${assignmentsInserted}/${toInsertAssignments.length}`);
  }

  // per-row insert for active (capacity trigger may fire)
  for (const a of active) {
    const { data, error } = await supabase
      .from('room_assignments')
      .insert([a])
      .select('id');
    if (error) {
      assignmentsFailed.push({ reason: error.message, payload: a });
    } else {
      assignmentsInserted += (data || []).length;
    }
    process.stdout.write(`\r  inserted: ${assignmentsInserted}/${toInsertAssignments.length}`);
  }
  process.stdout.write('\n');

  if (assignmentsFailed.length) {
    console.log(`  ${assignmentsFailed.length} assignment(s) failed — see audit for details.`);
  }
}

// --- step 4b: single summary activity_log entry ---------------------------
if (!dryRun && toInsert.length > 0) {
  const { error: alErr } = await supabase
    .from('activity_log')
    .insert({
      user_id: null,
      action: 'resident.bulk_imported',
      entity_type: 'import_batch',
      entity_id: null,
      details: {
        source: 'data/residents.csv',
        residents_inserted: toInsert.length,
        residents_skipped_existing: skipExisting.length,
        apartments_created: apartmentsCreatedCount,
        rooms_created: roomsCreatedCount,
        assignments_inserted: assignmentsInserted,
        assignments_failed: assignmentsFailed.length,
        target,
        generated_at: transformed.generated_at,
      },
    });
  if (alErr) console.error('activity_log summary insert failed (non-fatal):', alErr.message);
}

// --- step 5: post-import audit --------------------------------------------
console.log('');
console.log('Step 5/5 — post-import audit…');

const auditLines = [];
const aLog = (s = '') => auditLines.push(s);

aLog('='.repeat(80));
aLog('SAKAN ALSAYD — POST-IMPORT AUDIT');
aLog(`Target:    ${target}`);
aLog(`Project:   ${expectedRef}`);
aLog(`Generated: ${new Date().toISOString()}`);
aLog(`Dry run:   ${dryRun}`);
aLog('='.repeat(80));
aLog('');

if (!dryRun) {
  // resident counts
  const { count: rTotal } = await supabase
    .from('residents')
    .select('*', { count: 'exact', head: true });
  const { count: rActive } = await supabase
    .from('residents')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  aLog(`residents total:     ${rTotal}`);
  aLog(`residents active:    ${rActive}`);
  aLog(`residents checked_out: ${(rTotal || 0) - (rActive || 0)}`);

  const { count: aptTotal } = await supabase
    .from('apartments')
    .select('*', { count: 'exact', head: true });
  aLog(`apartments total:    ${aptTotal}`);

  const { count: roomTotal } = await supabase
    .from('rooms')
    .select('*', { count: 'exact', head: true });
  aLog(`rooms total:         ${roomTotal}`);

  const { count: assignTotal } = await supabase
    .from('room_assignments')
    .select('*', { count: 'exact', head: true });
  const { count: assignActive } = await supabase
    .from('room_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  aLog(`room_assignments total:  ${assignTotal}`);
  aLog(`room_assignments active: ${assignActive}`);

  // 5 random residents for spot-check
  aLog('');
  aLog('Random spot-check residents:');
  const { data: sample } = await supabase
    .from('residents')
    .select('id, full_name, phone, status, national_id_or_iqama')
    .order('created_at', { ascending: false })
    .limit(10);
  for (const s of sample || []) {
    aLog(`  ${s.id}  ${s.status.padEnd(12)}  ${s.full_name}  (id=${s.national_id_or_iqama || '—'})`);
  }
}

aLog('');
aLog('Local counts (for cross-check):');
aLog(`  residents in transform:      ${transformed.residents.length}`);
aLog(`  residents inserted this run: ${dryRun ? '(dry-run)' : toInsert.length}`);
aLog(`  residents skipped (existed): ${skipExisting.length}`);
aLog(`  apartments created this run: ${apartmentsCreatedCount}`);
aLog(`  rooms created this run:      ${roomsCreatedCount}`);
aLog(`  assignments planned:         ${toInsertAssignments.length}`);
aLog(`  assignments inserted ok:     ${dryRun ? '(dry-run)' : assignmentsInserted}`);
aLog(`  assignments failed:          ${dryRun ? '(dry-run)' : assignmentsFailed.length}`);

if (!dryRun && assignmentsFailed.length) {
  aLog('');
  aLog('Failed assignments (first 20):');
  for (const f of assignmentsFailed.slice(0, 20)) {
    aLog(`  ${f.reason}`);
    aLog(`    payload: ${JSON.stringify(f.payload)}`);
  }
}

const auditPath = path.join(__dirname, 'reports', `04-audit-${target}.txt`);
fs.writeFileSync(auditPath, auditLines.join('\n') + '\n', 'utf8');

console.log('');
console.log(auditLines.join('\n'));
console.log('');
console.log(`Audit written to ${path.relative(ROOT, auditPath)}`);
console.log(dryRun ? '\n[dry-run complete — no DB writes performed]' : '\n[done]');

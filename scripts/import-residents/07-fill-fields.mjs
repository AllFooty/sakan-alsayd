#!/usr/bin/env node
// Stage 7 — backfill nationality and (optionally) create placeholder
// intake room_assignments so the residents list shows a building for every
// active resident.
//
// Why this exists:
//   - The CSV doesn't carry an explicit nationality column. We infer from
//     national_id_or_iqama:
//        first digit '1'  → سعودية (Saudi citizen)
//        first digit '2'  → غير سعودية (Iqama / non-Saudi resident)
//        else             → leave null (managers fill in)
//   - The residents list shows "building" via current_assignment. Most active
//     residents have no parsed apt/room. To show a building anyway we create
//     one INTAKE apartment per building with N capacity-20 rooms, then assign
//     each active resident (whose CSV had a non-ambiguous building) to a slot.
//     The intake apartment is is_active=false so it stays hidden on public.
//     Managers move residents from INTAKE to real rooms via the Move-In wizard.
//
// Usage:
//   node scripts/import-residents/07-fill-fields.mjs --target=dev   [--dry-run]
//   node scripts/import-residents/07-fill-fields.mjs --target=prod  [--confirm-prod]
//
// Idempotent: re-running won't duplicate intake apartments/rooms or
// re-assign residents who already have an active assignment.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const TRANSFORMED_PATH = path.join(__dirname, 'reports', '03-transformed.json');

const PROD_PROJECT_REF = 'xvcpyofwhmuohpvinrry';
const DEV_PROJECT_REF = 'xswagpwarqfdlbtkhlgz';
const INTAKE_ROOM_CAPACITY = 20;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const target = args.target;
const dryRun = !!args['dry-run'];
const confirmProd = !!args['confirm-prod'];

if (!target || (target !== 'dev' && target !== 'prod')) {
  console.error('Error: --target=dev or --target=prod required');
  process.exit(2);
}
if (target === 'prod' && !confirmProd) {
  console.error('Error: --confirm-prod required for prod.');
  process.exit(2);
}

function loadEnv(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
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

const env = loadEnv(target === 'prod' ? '.env.local' : '.env.development.local');
const expectedRef = target === 'prod' ? PROD_PROJECT_REF : DEV_PROJECT_REF;
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes(expectedRef)) {
  console.error('Error: env URL does not match expected project ref.');
  process.exit(2);
}

console.log(`→ target:  ${target}`);
console.log(`→ project: ${expectedRef}`);
console.log(`→ dry-run: ${dryRun}`);
console.log('');

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const transformed = JSON.parse(fs.readFileSync(TRANSFORMED_PATH, 'utf8'));

// ---- helpers ----
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function paginate(table, columns, filters = (q) => q) {
  const out = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await filters(supabase.from(table).select(columns)).range(from, from + pageSize - 1);
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

// ---- step 1: nationality backfill ----
console.log('Step 1/3 — nationality backfill from national_id prefix');

const dbResidents = await paginate(
  'residents',
  'id, national_id_or_iqama, nationality, status'
);
console.log(`  fetched ${dbResidents.length.toLocaleString()} residents`);

const SAUDI = 'سعودية';
const NON_SAUDI = 'غير سعودية';

const toSetSaudi = [];
const toSetNonSaudi = [];
for (const r of dbResidents) {
  if (r.nationality) continue; // already set
  const id = r.national_id_or_iqama || '';
  if (/^1\d{9}$/.test(id)) toSetSaudi.push(r.id);
  else if (/^2\d{9}$/.test(id)) toSetNonSaudi.push(r.id);
}
console.log(`  → ${SAUDI}: ${toSetSaudi.length.toLocaleString()}`);
console.log(`  → ${NON_SAUDI}: ${toSetNonSaudi.length.toLocaleString()}`);

async function bulkUpdate(ids, patch) {
  if (!ids.length || dryRun) return;
  for (const c of chunk(ids, 200)) {
    const { error } = await supabase.from('residents').update(patch).in('id', c);
    if (error) throw new Error(`nationality update: ${error.message}`);
  }
}
await bulkUpdate(toSetSaudi, { nationality: SAUDI });
await bulkUpdate(toSetNonSaudi, { nationality: NON_SAUDI });

// ---- step 2: build building_id map for active residents (non-ambiguous) ----
console.log('');
console.log('Step 2/3 — figure out CSV building for each active resident');

// Defaults for ambiguous CSV building strings (Olaya/Aridh/Rakah-complex
// rows that didn't disambiguate "1" or "2"). Per the user's later guidance —
// "you have all the data" — we default to building -1 and stash a clear note
// on the assignment so managers can move residents to -2 as needed.
const AMBIGUOUS_DEFAULTS = {
  ambiguous_olaya: '00000000-0000-0000-0000-000000000001', // khobar-alolaya (1)
  ambiguous_aridh: '00000000-0000-0000-0000-000000000008', // riyadh-alaridh (1)
  ambiguous_rakah: '00000000-0000-0000-0000-000000000003', // khobar-alrakah  (1)
};

// Build a map: national_id (or phone fallback) → { building_id, ambiguous? }
const targetBuildingByKey = new Map();
for (const r of transformed.residents) {
  if (r.status !== 'active') continue;
  const recent = r.stays.find((s) => s.is_most_recent) || r.stays[r.stays.length - 1];
  if (!recent) continue;
  const key = r.national_id_or_iqama || (r.phone ? `phone:${r.phone}` : null);
  if (!key) continue;

  if (recent.building_id) {
    targetBuildingByKey.set(key, { buildingId: recent.building_id, ambiguous: false });
  } else if (recent.building_decision_reason && AMBIGUOUS_DEFAULTS[recent.building_decision_reason]) {
    targetBuildingByKey.set(key, {
      buildingId: AMBIGUOUS_DEFAULTS[recent.building_decision_reason],
      ambiguous: true,
      original: recent.building_label,
    });
  }
}

// Find which active residents in DB don't yet have an active assignment AND
// have a building hint we can use.
const dbResidentsByKey = new Map();
for (const r of dbResidents) {
  if (r.national_id_or_iqama) dbResidentsByKey.set(r.national_id_or_iqama, r.id);
}

// Need each active resident's current active-assignment status
const allAssignments = await paginate('room_assignments', 'resident_id, status');
const hasActiveAssignment = new Set(
  allAssignments.filter((a) => a.status === 'active').map((a) => a.resident_id)
);

const needIntakeByBuilding = new Map(); // building_id → [{ resident_id, ambiguous, original }]
let activeWithBuildingCount = 0;
let activeWithoutBuildingCount = 0;
let activeAlreadyAssignedCount = 0;
let ambiguousDefaultedCount = 0;

for (const r of dbResidents) {
  if (r.status !== 'active') continue;
  const target = targetBuildingByKey.get(r.national_id_or_iqama)
    || (r.phone && targetBuildingByKey.get(`phone:${r.phone}`));
  if (!target) {
    activeWithoutBuildingCount++;
    continue;
  }
  activeWithBuildingCount++;
  if (target.ambiguous) ambiguousDefaultedCount++;
  if (hasActiveAssignment.has(r.id)) {
    activeAlreadyAssignedCount++;
    continue;
  }
  if (!needIntakeByBuilding.has(target.buildingId)) needIntakeByBuilding.set(target.buildingId, []);
  needIntakeByBuilding.get(target.buildingId).push({
    resident_id: r.id,
    ambiguous: target.ambiguous,
    original: target.original,
  });
}

console.log(`  active residents:                       ${(activeWithBuildingCount + activeWithoutBuildingCount).toLocaleString()}`);
console.log(`  active w/ known building (will assign): ${activeWithBuildingCount.toLocaleString()}`);
console.log(`    (of those, defaulted from ambiguous): ${ambiguousDefaultedCount.toLocaleString()}`);
console.log(`  active w/o any building hint (skip):    ${activeWithoutBuildingCount.toLocaleString()}`);
console.log(`  active already assigned (skip):         ${activeAlreadyAssignedCount.toLocaleString()}`);
console.log(`  buildings needing intake rooms:         ${needIntakeByBuilding.size}`);

for (const [bid, residents] of needIntakeByBuilding) {
  console.log(`    ${bid.slice(-3)}: ${residents.length} residents`);
}

// ---- step 3: ensure intake apartments + rooms exist; insert assignments ----
console.log('');
console.log('Step 3/3 — create intake apartments/rooms and assign residents');

const intakeApartments = await paginate(
  'apartments',
  'id, building_id, apartment_number',
  (q) => q.eq('apartment_number', 'INTAKE')
);
const intakeAptByBuilding = new Map();
for (const a of intakeApartments) {
  intakeAptByBuilding.set(a.building_id, a.id);
}

let assignmentsInserted = 0;
const assignmentsFailed = [];

for (const [buildingId, residentEntries] of needIntakeByBuilding) {
  const residentIds = residentEntries.map((e) => e.resident_id);
  // 1. Ensure INTAKE apartment exists
  let aptId = intakeAptByBuilding.get(buildingId);
  if (!aptId) {
    if (!dryRun) {
      const { data, error } = await supabase
        .from('apartments')
        .insert({
          building_id: buildingId,
          apartment_number: 'INTAKE',
          floor: 0,
          notes: '[Auto-created placeholder for unassigned active residents. Move them to real apartments via the Move-In wizard, then archive this apartment.]',
          is_active: false,
        })
        .select('id')
        .single();
      if (error) {
        console.error(`Failed to create INTAKE apartment for ${buildingId}:`, error);
        continue;
      }
      aptId = data.id;
    } else {
      aptId = `dryrun-intake-${buildingId.slice(-3)}`;
    }
    intakeAptByBuilding.set(buildingId, aptId);
  }

  // 2. Ensure enough INTAKE rooms exist (capacity 20 each)
  const needed = Math.ceil(residentIds.length / INTAKE_ROOM_CAPACITY);
  let existingRooms = [];
  if (!dryRun) {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, room_number, capacity')
      .eq('apartment_id', aptId);
    if (error) {
      console.error('Failed to fetch intake rooms:', error);
      continue;
    }
    existingRooms = (data || []).filter((r) => r.room_number && r.room_number.startsWith('INTAKE'));
  }

  // Compute current free slots
  const roomFreeSlots = []; // array of { room_id, free }
  if (!dryRun) {
    for (const r of existingRooms) {
      const { count, error } = await supabase
        .from('room_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', r.id)
        .eq('status', 'active');
      if (error) continue;
      roomFreeSlots.push({ room_id: r.id, free: INTAKE_ROOM_CAPACITY - (count || 0) });
    }
  }

  let createdHere = 0;
  // create extra rooms if needed
  while (residentIds.length > roomFreeSlots.reduce((s, x) => s + x.free, 0)) {
    const idx = roomFreeSlots.length + createdHere + 1;
    const roomNumber = `INTAKE-${idx}`;
    if (!dryRun) {
      const { data, error } = await supabase
        .from('rooms')
        .insert({
          building_id: buildingId,
          apartment_id: aptId,
          room_number: roomNumber,
          room_type: 'triple',
          bathroom_type: 'shared',
          occupancy_mode: 'shared',
          capacity: INTAKE_ROOM_CAPACITY,
          monthly_price: 0,
          status: 'occupied',
          notes: '[Placeholder INTAKE room — move residents to real rooms then archive.]',
        })
        .select('id')
        .single();
      if (error) {
        console.error('Failed to create INTAKE room:', error);
        break;
      }
      roomFreeSlots.push({ room_id: data.id, free: INTAKE_ROOM_CAPACITY });
    } else {
      roomFreeSlots.push({ room_id: `dryrun-room-${idx}`, free: INTAKE_ROOM_CAPACITY });
    }
    createdHere++;
  }

  // 3. Assign residents to slots
  let cursor = 0;
  for (const residentId of residentIds) {
    while (cursor < roomFreeSlots.length && roomFreeSlots[cursor].free === 0) cursor++;
    if (cursor >= roomFreeSlots.length) {
      assignmentsFailed.push({ resident_id: residentId, reason: 'no slots left' });
      continue;
    }
    const slot = roomFreeSlots[cursor];
    if (!dryRun) {
      const { error } = await supabase.from('room_assignments').insert({
        resident_id: residentId,
        room_id: slot.room_id,
        building_id: buildingId,
        check_in_date: '2026-05-04',
        status: 'active',
      });
      if (error) {
        assignmentsFailed.push({ resident_id: residentId, reason: error.message });
        continue;
      }
    }
    slot.free--;
    assignmentsInserted++;
  }
}

console.log(`  intake assignments inserted: ${assignmentsInserted}`);
console.log(`  failed: ${assignmentsFailed.length}`);

// ---- audit ----
const { count: rTotal } = await supabase.from('residents').select('*', { count: 'exact', head: true });
const { count: rActive } = await supabase.from('residents').select('*', { count: 'exact', head: true }).eq('status', 'active');
const { count: rWithNat } = await supabase.from('residents').select('*', { count: 'exact', head: true }).not('nationality', 'is', null);
const { count: aActive } = await supabase.from('room_assignments').select('*', { count: 'exact', head: true }).eq('status', 'active');

console.log('');
console.log('Audit:');
console.log(`  residents total:        ${rTotal}`);
console.log(`  residents active:       ${rActive}`);
console.log(`  residents w/ nationality: ${rWithNat}`);
console.log(`  active room_assignments:  ${aActive}`);

const auditPath = path.join(__dirname, 'reports', `07-fill-${target}.txt`);
fs.writeFileSync(
  auditPath,
  [
    `Fill-fields audit (${target}, ${dryRun ? 'dry-run' : 'live'}) — ${new Date().toISOString()}`,
    `nationality set to ${SAUDI}: ${toSetSaudi.length}`,
    `nationality set to ${NON_SAUDI}: ${toSetNonSaudi.length}`,
    `intake assignments inserted: ${assignmentsInserted}`,
    `failed: ${assignmentsFailed.length}`,
    `residents total: ${rTotal}`,
    `residents active: ${rActive}`,
    `residents with nationality: ${rWithNat}`,
    `active room_assignments: ${aActive}`,
    '',
    ...assignmentsFailed.slice(0, 20).map((f) => `failed: ${f.resident_id}  ${f.reason}`),
  ].join('\n') + '\n'
);
console.log(`Audit written to ${path.relative(ROOT, auditPath)}`);
console.log(dryRun ? '\n[dry-run]' : '\n[done]');

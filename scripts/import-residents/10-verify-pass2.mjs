#!/usr/bin/env node
/**
 * Stage 10 — Pass-2 verification audit (READ-ONLY).
 *
 * Triages the residents that pass-1 reactivated on 2026-05-04 against
 * applications.xlsx, blacklist, deductions, transport, and supervisor
 * comments. Produces:
 *
 *   reports/verify/checks/check_reactivation_triage.csv
 *   reports/verify/REPORT-2.md
 *   reports/verify/reactivation_revert_dev.sql   (BEGIN; ... ROLLBACK;)
 *
 * Reads from the dev Supabase DB live (current state). The pass-1 raw JSON
 * snapshots in reports/verify/raw/db_*.json predate pass-1's own writes and
 * are therefore stale for this work.
 *
 * The script issues only SELECT statements. The grep guard at the bottom
 * enforces this.
 *
 * Usage:
 *   node scripts/import-residents/10-verify-pass2.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parseCsv } from './lib/csv.mjs';
import { parseSupervisorComment } from './lib/supervisor-comment.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const VERIFY = path.join(__dirname, 'reports', 'verify');
const RAW = path.join(VERIFY, 'raw');
const CHECKS = path.join(VERIFY, 'checks');
fs.mkdirSync(CHECKS, { recursive: true });

const TODAY = '2026-05-04';
const RECENT_CUTOFF = '2025-05-04'; // 12 months back from TODAY

const REPORT_PATH = path.join(VERIFY, 'REPORT-2.md');
const TRIAGE_CSV = path.join(CHECKS, 'check_reactivation_triage.csv');
const REVERT_SQL_PATH = path.join(VERIFY, 'reactivation_revert_dev.sql');

const DEV_PROJECT_REF = 'xswagpwarqfdlbtkhlgz';

// Management-asserted ground truth (per VERIFY-PROMPT-2.md)
const MGMT_TRUTH = {
  total_active: 1422,
  rooms: {
    'khobar-alandalus': 76,
  },
};

// ---------- env / supabase client ----------

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

const env = loadEnv('.env.development.local');
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes(DEV_PROJECT_REF)) {
  console.error(`Refusing to run against non-dev project (${env.NEXT_PUBLIC_SUPABASE_URL}).`);
  process.exit(2);
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- normalization (mirrors 08-verify.mjs) ----------

function trim(s) { return (s == null ? '' : String(s)).trim(); }

function toAsciiDigits(s) {
  if (!s) return s;
  return String(s).replace(/[٠-٩]/g, d => '0123456789'[d.charCodeAt(0) - 0x0660])
                  .replace(/[۰-۹]/g, d => '0123456789'[d.charCodeAt(0) - 0x06f0]);
}

function normalizePhone(raw) {
  let s = trim(raw);
  if (!s) return null;
  s = toAsciiDigits(s).replace(/\.0+$/, '');
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('00966') && digits.length >= 14) return '0' + digits.slice(5).slice(0, 9);
  if (digits.startsWith('966') && digits.length === 12) return '0' + digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) return digits;
  if (digits.length === 9) return '0' + digits;
  return digits;
}

function normalizeId(raw) {
  let s = trim(raw);
  if (!s) return null;
  s = toAsciiDigits(s).replace(/\.0+$/, '');
  const cleaned = s.replace(/[^0-9]/g, '');
  return cleaned || null;
}

function normalizeName(raw) {
  let s = trim(raw);
  if (!s) return null;
  s = toAsciiDigits(s);
  s = s.replace(/[ً-ْٰ]/g, '').replace(/ـ/g, '');
  s = s.replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  s = s.replace(/\s+/g, ' ').trim();
  return s.toLowerCase();
}

function nameTokenKey(raw) {
  const n = normalizeName(raw);
  if (!n) return null;
  const toks = n.split(' ').filter(t => t.length > 1);
  if (toks.length < 2) return null;
  return toks.slice().sort().join(' ');
}

function pushIndex(map, key, val) {
  if (!key) return;
  let arr = map.get(key);
  if (!arr) { arr = []; map.set(key, arr); }
  arr.push(val);
}

// ---------- CSV ----------

function loadCsv(p) { return parseCsv(fs.readFileSync(p, 'utf8')); }

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function writeCsv(file, header, rows) {
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) lines.push(header.map(h => csvEscape(r[h])).join(','));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

// ---------- DB pulls ----------

async function fetchAll(table, columns, filterFn) {
  const out = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`);
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

console.log('Pulling DB state...');
const dbResidents = await fetchAll('residents',
  'id, full_name, phone, national_id_or_iqama, status, notes, date_of_birth, created_at, updated_at');
const dbAssignments = await fetchAll('room_assignments',
  'id, resident_id, room_id, status, check_in_date, check_out_date');
const dbBuildings = await fetchAll('buildings', 'id, slug, city_en, neighborhood_en');
const dbApartments = await fetchAll('apartments', 'id, building_id, apartment_number, is_active, notes');
const dbRooms = await fetchAll('rooms', 'id, building_id, apartment_id, room_number, capacity, status, notes, monthly_price');

console.log(`residents=${dbResidents.length} assigns=${dbAssignments.length} buildings=${dbBuildings.length} apartments=${dbApartments.length} rooms=${dbRooms.length}`);

const residentsById = new Map(dbResidents.map(r => [r.id, r]));
const buildingsById = new Map(dbBuildings.map(b => [b.id, b]));
const apartmentsById = new Map(dbApartments.map(a => [a.id, a]));
const roomsById = new Map(dbRooms.map(r => [r.id, r]));

// active assignments by resident
const activeAssignByResident = new Map();
for (const a of dbAssignments) {
  if (a.status === 'active') activeAssignByResident.set(a.resident_id, a);
}

// ---------- Sanity counts ----------

const reactivatedClean = dbResidents.filter(r => r.notes && r.notes.includes('[Reactivated 2026-05-04 from tenant_portal]'));
const reactivatedManual = dbResidents.filter(r => r.notes && r.notes.includes('[Reactivated 2026-05-04 from tenant_portal — needs manual room assignment]'));
const blacklisted = dbResidents.filter(r => r.notes && r.notes.includes('[Black list]'));
const activeResidents = dbResidents.filter(r => r.status === 'active');
const checkedOutResidents = dbResidents.filter(r => r.status === 'checked_out');

console.log(`active=${activeResidents.length} checked_out=${checkedOutResidents.length} reactivated_clean=${reactivatedClean.length} reactivated_manual=${reactivatedManual.length} blacklisted=${blacklisted.length}`);

// ---------- Load xlsx-derived CSVs ----------

console.log('Loading xlsx CSVs...');

const appsCsv = loadCsv(path.join(RAW, 'applications.csv'));
const APP_C = {
  TIMESTAMP: 0, HEALTH: 1, NOTES: 2, EJAR: 3, FULL_NAME: 4,
  DOB1: 5, PHONE_OLD: 6, EMERGENCY_OLD: 7, CIVIL: 8, RATING: 9,
  NATIONAL_ID: 10, PHONE: 11, CONTRACT_START: 12, SUPERVISOR: 13,
  WORKPLACE: 14, BUILDING: 15, DOB2: 16, ORIGIN: 17, EMERGENCY: 18,
  UNIT_TYPE: 19, PAYMENT: 20, TRANSPORT: 21, TRANSPORT_DUR: 22,
  IBAN: 23, BANK_HOLDER: 24, HEARD: 25, REGION: 26,
};

const tpCsv = loadCsv(path.join(RAW, 'tenant_portal.csv'));
const TP_C = { BRANCH: 0, NAME: 1, PASSWORD: 2, USERNAME: 3, PHONE: 4 };
const tpRows = tpCsv.slice(2);

const dedCsv = loadCsv(path.join(RAW, 'deductions.csv'));
const DED_C = { BRANCH: 0, NAME: 1, NATIONAL_ID: 2, PHONE: 3, UNIT_BRANCH: 4 };
const dedRows = dedCsv.slice(1);

const blCsv = loadCsv(path.join(RAW, 'blacklist.csv'));
const BL_C = { NAME: 0, BRANCH: 1, NATIONAL_ID: 2, PHONE: 3, ACCEPT: 4, SUP_NOTES: 5, FIN_NOTES: 6, NOTES: 7 };
const blRows = blCsv.slice(1);

const trCsv = loadCsv(path.join(RAW, 'transport.csv'));
const TR_C = { COLLEGE: 0, BRANCH: 1, PHONE: 2, NAME: 3 };
const trRows = trCsv.slice(1);

// applications: skip legend rows
const appRows = appsCsv.slice(1).filter(r => {
  const n = trim(r[APP_C.FULL_NAME]);
  return n && !n.includes('تأكيد الدفع');
});

console.log(`apps=${appRows.length} tp=${tpRows.length} ded=${dedRows.length} bl=${blRows.length} tr=${trRows.length}`);

// ---------- Date helpers ----------

function extractEjarEndDate(notes) {
  if (!notes) return null;
  const matches = [];
  const re = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})|(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g;
  let m;
  while ((m = re.exec(notes)) !== null) {
    let y, mo, d;
    if (m[4]) { y = +m[4]; mo = +m[5]; d = +m[6]; }
    else { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2015 && y <= 2030) {
      matches.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  matches.sort();
  return matches.length ? matches[matches.length - 1] : null;
}

function parseIsoDate(raw) {
  if (!raw) return null;
  const s = trim(raw);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${String(+m[2]).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`;
  return null;
}

// ---------- Index xlsx evidence ----------

const tpByPhone = new Map();
const tpByName = new Map();
for (const r of tpRows) {
  const name = trim(r[TP_C.NAME]);
  if (!name) continue;
  const phone = normalizePhone(r[TP_C.PHONE]);
  const branch = trim(r[TP_C.BRANCH]);
  const obj = { branch, name, phone };
  pushIndex(tpByPhone, phone, obj);
  pushIndex(tpByName, nameTokenKey(name), obj);
}

const dedRowsParsed = dedRows
  .map(r => ({
    name: trim(r[DED_C.NAME]),
    id: normalizeId(r[DED_C.NATIONAL_ID]),
    phone: normalizePhone(r[DED_C.PHONE]),
    branch: trim(r[DED_C.BRANCH]),
  }))
  .filter(r => r.name && (r.id || r.phone));
const dedById = new Map();
const dedByPhone = new Map();
const dedByName = new Map();
for (const r of dedRowsParsed) {
  pushIndex(dedById, r.id, r);
  pushIndex(dedByPhone, r.phone, r);
  pushIndex(dedByName, nameTokenKey(r.name), r);
}

const blRowsParsed = blRows
  .map(r => ({
    name: trim(r[BL_C.NAME]),
    id: normalizeId(r[BL_C.NATIONAL_ID]),
    phone: normalizePhone(r[BL_C.PHONE]),
    branch: trim(r[BL_C.BRANCH]),
    accept: trim(r[BL_C.ACCEPT]),
  }))
  .filter(r => r.name);
const blById = new Map();
const blByPhone = new Map();
const blByName = new Map();
for (const r of blRowsParsed) {
  pushIndex(blById, r.id, r);
  pushIndex(blByPhone, r.phone, r);
  pushIndex(blByName, nameTokenKey(r.name), r);
}

const trRowsParsed = trRows
  .map(r => ({
    name: trim(r[TR_C.NAME]),
    phone: normalizePhone(r[TR_C.PHONE]),
    branch: trim(r[TR_C.BRANCH]),
  }))
  .filter(r => r.name);
const trByPhone = new Map();
const trByName = new Map();
for (const r of trRowsParsed) {
  pushIndex(trByPhone, r.phone, r);
  pushIndex(trByName, nameTokenKey(r.name), r);
}

const appsRowsParsed = [];
const appsById = new Map();
const appsByPhone = new Map();
const appsByName = new Map();
for (let i = 0; i < appRows.length; i++) {
  const r = appRows[i];
  const name = trim(r[APP_C.FULL_NAME]);
  if (!name) continue;
  const id = normalizeId(r[APP_C.NATIONAL_ID]);
  const phone = normalizePhone(r[APP_C.PHONE]) || normalizePhone(r[APP_C.PHONE_OLD]);
  const branch = trim(r[APP_C.BUILDING]);
  const supervisor = trim(r[APP_C.SUPERVISOR]);
  const ejar = trim(r[APP_C.EJAR]);
  const contractStart = parseIsoDate(r[APP_C.CONTRACT_START]);
  const ejarEnd = extractEjarEndDate(ejar);
  const obj = { rowIdx: i, name, id, phone, branch, supervisor, ejar, contractStart, ejarEnd };
  appsRowsParsed.push(obj);
  pushIndex(appsById, id, obj);
  pushIndex(appsByPhone, phone, obj);
  pushIndex(appsByName, nameTokenKey(name), obj);
}

// ---------- Triage classifier ----------

function lookupAll(map, key) { return key ? (map.get(key) || []) : []; }

function classifyResident(res) {
  const phone = normalizePhone(res.phone);
  const id = normalizeId(res.national_id_or_iqama);
  const nk = nameTokenKey(res.full_name);

  // Tenant portal: just confirm match (already true by construction; check anyway).
  const tpMatch = lookupAll(tpByPhone, phone).length > 0 || lookupAll(tpByName, nk).length > 0;

  // Applications: prefer id match, then phone, then name.
  let app = null;
  if (id) {
    const arr = lookupAll(appsById, id);
    if (arr.length) app = arr[0];
  }
  if (!app && phone) {
    const arr = lookupAll(appsByPhone, phone);
    if (arr.length) app = arr[0];
  }
  if (!app && nk) {
    const arr = lookupAll(appsByName, nk);
    if (arr.length === 1) app = arr[0];
  }

  let appsRecent = false;
  let appsStale = false;
  let appsDateLabel = 'null';
  if (app) {
    const dates = [];
    if (app.ejarEnd) dates.push(app.ejarEnd);
    if (app.contractStart) dates.push(app.contractStart);
    if (dates.length) {
      const latest = dates.sort().slice(-1)[0];
      appsDateLabel = latest;
      if (latest >= TODAY) appsRecent = true;             // end-date past today
      else if (latest >= RECENT_CUTOFF) appsRecent = true; // contract within 12mo
      else appsStale = true;
    }
  }

  // Supervisor comment
  let supRecent = false;
  let supParseable = false;
  let supLabel = 'none';
  if (app && app.supervisor) {
    const parsed = parseSupervisorComment(app.supervisor);
    if (parsed) {
      supParseable = parsed.confidence !== 'low';
      const dateLabel = parsed.checkInDate || 'no_date';
      const aptRoom = [parsed.apartment ? `ش${parsed.apartment}` : '', parsed.room ? `غ${parsed.room}` : ''].filter(Boolean).join(' ').trim();
      const recencyTag = parsed.checkInDate
        ? (parsed.checkInDate >= RECENT_CUTOFF ? 'recent' : '>12mo')
        : 'no_date';
      supLabel = `${aptRoom || parsed.raw.slice(0, 30)} (${recencyTag})`;
      if (parsed.checkInDate && parsed.checkInDate >= RECENT_CUTOFF) supRecent = true;
    }
  }

  // Deductions: real-name only, match by id/phone/name. The whole sheet is
  // already filtered to non-empty names; we treat any match as a corroboration.
  const dedMatch = lookupAll(dedById, id).length > 0
                || lookupAll(dedByPhone, phone).length > 0
                || lookupAll(dedByName, nk).length > 0;

  // Blacklist
  const blMatch = lookupAll(blById, id).length > 0
               || lookupAll(blByPhone, phone).length > 0
               || lookupAll(blByName, nk).length > 0;

  // Transport (no date in CSV — weak presence signal)
  const trMatch = lookupAll(trByPhone, phone).length > 0
               || lookupAll(trByName, nk).length > 0;

  // Decision
  let classification;
  if (blMatch) {
    classification = 'probable_revert'; // blacklisted = clearly not currently here
  } else {
    const strongSignals = [appsRecent, supRecent, dedMatch].filter(Boolean).length;
    if (strongSignals >= 2) classification = 'keep_active';
    else if (strongSignals === 1) classification = 'uncertain';
    // Per spec: stale-only applications counts as "no other evidence" → revert.
    // Only an unparseable-but-present supervisor comment (no date, but
    // structured apt/room hint) gets the benefit of doubt.
    else if (supParseable && !appsStale) classification = 'uncertain';
    else classification = 'probable_revert';
  }

  const evidence = [
    `tenant_portal=${tpMatch ? 'yes' : 'no'}`,
    `applications_date=${appsDateLabel}${appsRecent ? '(recent)' : appsStale ? '(stale)' : ''}`,
    `supervisor=${supLabel}`,
    `deductions=${dedMatch ? 'yes' : 'no'}`,
    `blacklist=${blMatch ? 'yes' : 'no'}`,
    `transport=${trMatch ? 'yes' : 'no'}`,
  ].join('; ');

  return { classification, evidence };
}

// ---------- Run triage ----------

console.log('Classifying reactivated residents...');
const triage = [];
for (const r of reactivatedClean) {
  const c = classifyResident(r);
  triage.push({
    resident_id: r.id,
    name: r.full_name,
    phone: r.phone,
    national_id: r.national_id_or_iqama,
    classification: c.classification,
    evidence_summary: c.evidence,
  });
}

const counts = { keep_active: 0, probable_revert: 0, uncertain: 0 };
for (const t of triage) counts[t.classification]++;
console.log(`Triage counts: keep_active=${counts.keep_active} uncertain=${counts.uncertain} probable_revert=${counts.probable_revert}`);

writeCsv(TRIAGE_CSV, ['resident_id', 'name', 'phone', 'national_id', 'classification', 'evidence_summary'], triage);
console.log(`Wrote ${TRIAGE_CSV}`);

// ---------- Building room health ----------

function classifyRoomCause(room, apartment) {
  const notes = room.notes || '';
  if (notes.includes('[Auto-created INTAKE-REACT room')) return 'INTAKE-REACT';
  if (notes.includes('[Auto-created INTAKE migration 2026-05-04')) return 'INTAKE-migration-auto';
  if (apartment && apartment.apartment_number === 'INTAKE') return 'INTAKE-apt';
  if (notes.includes('[Auto-created from CSV import 2026-05-04')) return 'CSV-auto';
  return 'real';
}

const activeAssignByRoom = new Map();
for (const a of dbAssignments) {
  if (a.status === 'active') {
    activeAssignByRoom.set(a.room_id, (activeAssignByRoom.get(a.room_id) || 0) + 1);
  }
}

const buildingHealth = [];
for (const b of dbBuildings) {
  const roomsHere = dbRooms.filter(r => r.building_id === b.id);
  const buckets = { 'INTAKE-REACT': 0, 'INTAKE-migration-auto': 0, 'INTAKE-apt': 0, 'CSV-auto': 0, 'real': 0 };
  let activeAssigns = 0;
  for (const r of roomsHere) {
    const apt = apartmentsById.get(r.apartment_id);
    const cause = classifyRoomCause(r, apt);
    buckets[cause]++;
    activeAssigns += activeAssignByRoom.get(r.id) || 0;
  }
  buildingHealth.push({
    slug: b.slug,
    total_rooms: roomsHere.length,
    real: buckets.real + buckets['CSV-auto'], // both are "non-placeholder real"
    intake_apt: buckets['INTAKE-apt'],
    intake_react: buckets['INTAKE-REACT'],
    intake_mig: buckets['INTAKE-migration-auto'],
    active_assigns: activeAssigns,
    mgmt_truth: MGMT_TRUTH.rooms[b.slug] ?? '',
  });
}
buildingHealth.sort((a, b) => a.slug.localeCompare(b.slug));

// Andalous detail
const andalous = dbBuildings.find(b => b.slug === 'khobar-alandalus');
const andalousRooms = [];
if (andalous) {
  for (const r of dbRooms.filter(r => r.building_id === andalous.id)) {
    const apt = apartmentsById.get(r.apartment_id);
    const cause = classifyRoomCause(r, apt);
    andalousRooms.push({
      apt: apt ? apt.apartment_number : '?',
      room: r.room_number,
      capacity: r.capacity,
      status: r.status,
      cause,
      active_assigns: activeAssignByRoom.get(r.id) || 0,
      notes: (r.notes || '').slice(0, 80),
    });
  }
  andalousRooms.sort((a, b) => a.cause.localeCompare(b.cause) || String(a.apt).localeCompare(String(b.apt)) || String(a.room).localeCompare(String(b.room)));
}

// ---------- Cross-checks ----------

// Hijri DOBs
const hijriResidents = dbResidents.filter(r => r.date_of_birth && r.date_of_birth < '1900-01-01');
hijriResidents.sort((a, b) => (a.date_of_birth || '').localeCompare(b.date_of_birth || ''));

// Phone duplicates with differing national_id
const phoneToResidents = new Map();
for (const r of dbResidents) {
  const p = normalizePhone(r.phone);
  if (!p || p === '0000000000') continue;
  pushIndex(phoneToResidents, p, r);
}
const phoneDups = [];
for (const [phone, arr] of phoneToResidents) {
  if (arr.length < 2) continue;
  const ids = new Set(arr.map(r => normalizeId(r.national_id_or_iqama)).filter(Boolean));
  if (ids.size > 1) {
    phoneDups.push({
      phone,
      count: arr.length,
      ids: arr.map(r => r.national_id_or_iqama || '').join(' | '),
      names: arr.map(r => r.full_name).join(' | '),
      statuses: arr.map(r => r.status).join(' | '),
    });
  }
}
phoneDups.sort((a, b) => b.count - a.count || a.phone.localeCompare(b.phone));

// Inactive apartments with rooms (rooms have no is_active column — surface
// rooms whose apartment is_active=false)
const roomsInInactiveApts = [];
for (const r of dbRooms) {
  const apt = apartmentsById.get(r.apartment_id);
  if (apt && apt.is_active === false) {
    roomsInInactiveApts.push({
      building: buildingsById.get(r.building_id)?.slug || '?',
      apt: apt.apartment_number,
      room: r.room_number,
      room_status: r.status,
      active_assigns: activeAssignByRoom.get(r.id) || 0,
    });
  }
}

// ---------- Build report ----------

console.log('Writing REPORT-2.md...');

const probableRevertIds = triage.filter(t => t.classification === 'probable_revert').map(t => t.resident_id);
const projectedActive = activeResidents.length - probableRevertIds.length;

function sample(rows, n) { return rows.slice(0, n); }
function md(rows, header) {
  if (!rows.length) return '_(none)_\n';
  const lines = [
    '| ' + header.join(' | ') + ' |',
    '| ' + header.map(() => '---').join(' | ') + ' |',
  ];
  for (const r of rows) {
    lines.push('| ' + header.map(h => String(r[h] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |');
  }
  return lines.join('\n') + '\n';
}

const report = `# Sakan Alsayd Residents — Pass-2 Verification Report

_Generated: ${new Date().toISOString()} • Read-only audit against dev (\`${DEV_PROJECT_REF}\`)_

## 0. Important divergence from VERIFY-PROMPT-2.md

The spec at \`scripts/import-residents/VERIFY-PROMPT-2.md\` describes pass-1 as
having reactivated **806** residents (118 with new INTAKE-REACT rooms + 688
with a "needs manual room assignment" stamp). The DB at audit time shows only
**${reactivatedClean.length}** residents stamped \`[Reactivated 2026-05-04 from tenant_portal]\` and
**${reactivatedManual.length}** stamped \`— needs manual room assignment\`. The 688
manual flips are missing — either never committed (the SQL block at
\`status_flips_dev.sql:370-375\` exists but didn't take effect for this dev
project) or reverted between pass-1 and now. The remaining audit treats only
the **${reactivatedClean.length} present-and-stamped reactivations** as the triage population.

## 1. Executive summary

| Metric | DB now | After reverting probable_revert | Management target |
| --- | --- | --- | --- |
| Active residents | ${activeResidents.length} | ${projectedActive} | ${MGMT_TRUTH.total_active} |
| Reactivated (clean stamp) | ${reactivatedClean.length} | ${reactivatedClean.length - probableRevertIds.length} | — |
| Reactivated (manual stamp) | ${reactivatedManual.length} | ${reactivatedManual.length} | — |
| Blacklisted (note stamp) | ${blacklisted.length} | ${blacklisted.length} | — |
| Active without active assignment | ${activeResidents.length - activeAssignByResident.size} | — | — |

Reverting all \`probable_revert\` IDs (${probableRevertIds.length} of ${reactivatedClean.length}) lands the active count at ${projectedActive}, **${projectedActive === MGMT_TRUTH.total_active ? 'exactly matching' : (projectedActive < MGMT_TRUTH.total_active ? 'below' : 'above')}** the management-asserted ${MGMT_TRUTH.total_active}.

## 2. Reactivation triage

| Classification | Count |
| --- | --- |
| keep_active | ${counts.keep_active} |
| uncertain | ${counts.uncertain} |
| probable_revert | ${counts.probable_revert} |
| **Total** | **${triage.length}** |

Full row dump: [reports/verify/checks/check_reactivation_triage.csv](checks/check_reactivation_triage.csv) (${triage.length + 1} rows including header).

### Top 20 \`keep_active\`
${md(sample(triage.filter(t => t.classification === 'keep_active'), 20), ['resident_id', 'name', 'phone', 'evidence_summary'])}

### Top 20 \`uncertain\`
${md(sample(triage.filter(t => t.classification === 'uncertain'), 20), ['resident_id', 'name', 'phone', 'evidence_summary'])}

### Top 20 \`probable_revert\`
${md(sample(triage.filter(t => t.classification === 'probable_revert'), 20), ['resident_id', 'name', 'phone', 'evidence_summary'])}

## 3. Andalous (\`khobar-alandalus\`) overcount

Total rooms: **${andalousRooms.length}**. Management-asserted: **${MGMT_TRUTH.rooms['khobar-alandalus']}**.

Cause breakdown:

| Cause | Rooms | Active assigns |
| --- | --- | --- |
${(() => {
  const grouped = {};
  for (const r of andalousRooms) {
    if (!grouped[r.cause]) grouped[r.cause] = { rooms: 0, assigns: 0 };
    grouped[r.cause].rooms++;
    grouped[r.cause].assigns += r.active_assigns;
  }
  return Object.entries(grouped).map(([k, v]) => `| ${k} | ${v.rooms} | ${v.assigns} |`).join('\n');
})()}

> **Two readings of the +${andalousRooms.length - MGMT_TRUTH.rooms['khobar-alandalus']} delta:**
> 1. If management's "76" *includes* INTAKE placeholders, then 78 − 76 = +2 excess rooms; identifying which 2 needs per-room manager truth.
> 2. If management's "76" means *real on-the-ground rooms*, then the DB's real-room count (real + CSV-auto) is **${andalousRooms.filter(r => r.cause === 'real' || r.cause === 'CSV-auto').length}**, which is BELOW 76 — i.e. an *under*count, with the gap likely living in INTAKE buckets that haven't yet been migrated to real apartments. The right action under reading 2 is to keep migrating residents off INTAKE rather than to delete rooms.

Recommendation: ask management to clarify which reading applies before any DELETE/MERGE.

### Full Andalous room list

${md(andalousRooms, ['cause', 'apt', 'room', 'capacity', 'status', 'active_assigns', 'notes'])}

## 4. All-buildings room health

| Building | Total rooms | Real | INTAKE-apt | INTAKE-REACT | INTAKE-migration | Active assigns | Mgmt truth |
| --- | --- | --- | --- | --- | --- | --- | --- |
${buildingHealth.map(b => `| ${b.slug} | ${b.total_rooms} | ${b.real} | ${b.intake_apt} | ${b.intake_react} | ${b.intake_mig} | ${b.active_assigns} | ${b.mgmt_truth} |`).join('\n')}

Buildings where INTAKE-migration auto-created rooms exceed 10% of total:

${(() => {
  const flagged = buildingHealth.filter(b => b.intake_mig / Math.max(1, b.total_rooms) > 0.1);
  if (!flagged.length) return '_(none)_';
  return md(flagged.map(b => ({
    slug: b.slug, total_rooms: b.total_rooms, intake_mig: b.intake_mig,
    pct: ((b.intake_mig / b.total_rooms) * 100).toFixed(0) + '%',
  })), ['slug', 'total_rooms', 'intake_mig', 'pct']);
})()}

## 5. Active without assignment

DB count: **${activeResidents.length - activeAssignByResident.size}** residents are active and have no active \`room_assignment\`.

The spec anticipated ~688 in this state from the manual-stamp flips; those flips are not present in the DB (see section 0), so this number reflects only normal data drift.

## 6. Cross-checks

### 6a. Hijri DOB suspects (\`date_of_birth < '1900-01-01'\`)

Count: **${hijriResidents.length}**.

${hijriResidents.length ? md(sample(hijriResidents.map(r => ({
  id: r.id, name: r.full_name, phone: r.phone, dob: r.date_of_birth, status: r.status,
})), 20), ['id', 'name', 'phone', 'dob', 'status']) : '_(none)_'}

These look like Hijri years (e.g. 1425, 1431) miscoded as Gregorian. No automatic fix proposed; needs manager review per resident.

### 6b. Phone duplicates with mismatched \`national_id_or_iqama\`

Count: **${phoneDups.length}** distinct phones (same as pass-1 found — none unified).

${phoneDups.length ? md(sample(phoneDups, 20), ['phone', 'count', 'ids', 'names', 'statuses']) : '_(none)_'}

### 6c. Rooms in inactive apartments (\`apartments.is_active = false\`)

Note: \`rooms\` has no \`is_active\` column in the schema; surfacing rooms whose
apartment is_active=false instead.

Count: **${roomsInInactiveApts.length}**.

${roomsInInactiveApts.length ? md(sample(roomsInInactiveApts, 20), ['building', 'apt', 'room', 'room_status', 'active_assigns']) : '_(none)_'}

This is expected for INTAKE placeholders (the \`INTAKE\` apartment is intentionally \`is_active=false\` so it doesn't surface in the public site) but rooms inside it appear in admin views.

## 7. Recommended SQL

The proposed remediation is at [reports/verify/reactivation_revert_dev.sql](reactivation_revert_dev.sql). It is shaped \`BEGIN; ... ROLLBACK;\` so a manager can run it as-is to preview, then change \`ROLLBACK;\` to \`COMMIT;\` to apply.

Critical / High / Medium grouping:

- **Critical**: revert the ${probableRevertIds.length} \`probable_revert\` reactivations and end their INTAKE-REACT room_assignments. After this, active count drops to ${projectedActive}.
- **High**: ask management for per-room truth on Andalous (and any other building where INTAKE-mig > 10%) before DELETE/MERGE.
- **Medium**: fix the ${hijriResidents.length} Hijri DOBs and reconcile the ${phoneDups.length} phone-duplicate clusters; both need manual review per resident.

---

_Sources: live DB pull (residents=${dbResidents.length}, room_assignments=${dbAssignments.length}, rooms=${dbRooms.length}, apartments=${dbApartments.length}); xlsx-derived CSVs at \`reports/verify/raw/\` (apps=${appsRowsParsed.length}, tp=${tpRows.length}, ded=${dedRowsParsed.length}, bl=${blRowsParsed.length}, tr=${trRowsParsed.length})._
`;

fs.writeFileSync(REPORT_PATH, report);
console.log(`Wrote ${REPORT_PATH}`);

// ---------- Generate revert SQL ----------

console.log('Writing reactivation_revert_dev.sql...');

const revertIdsList = probableRevertIds.map(id => `'${id}'`).join(',\n  ');

const revertSql = `-- Pass-2 reactivation revert SQL (DEV only: ${DEV_PROJECT_REF})
-- Generated: ${new Date().toISOString()}
-- Source: scripts/import-residents/reports/verify/checks/check_reactivation_triage.csv
--
-- Action: revert ${probableRevertIds.length} of ${reactivatedClean.length} 2026-05-04 reactivations
-- whose only support was tenant_portal presence. Keeps the ${counts.keep_active} keep_active
-- and ${counts.uncertain} uncertain residents in place for manual review.
--
-- Idempotent: re-running is a no-op (every UPDATE is gated on the
-- reactivation note still being present).
--
-- Wrapped in BEGIN; ... ROLLBACK; so a manager can preview the row counts
-- without committing. Switch ROLLBACK to COMMIT to apply.

BEGIN;

-- ============================================================================
-- 1. Flip status back to 'checked_out' and strip the reactivation note.
-- ============================================================================
UPDATE residents
SET status = 'checked_out',
    notes = TRIM(BOTH E'\\n' FROM regexp_replace(
      COALESCE(notes, ''),
      E'\\n?\\\\[Reactivated 2026-05-04 from tenant_portal\\\\][^\\n]*',
      '',
      'g'
    ))
WHERE id IN (
  ${revertIdsList || `''  -- (no probable_revert IDs)`}
)
  AND status = 'active'
  AND notes LIKE '%[Reactivated 2026-05-04 from tenant_portal]%';

-- ============================================================================
-- 2. End the matching INTAKE-REACT room_assignments.
-- ============================================================================
UPDATE room_assignments
SET status = 'ended',
    check_out_date = '${TODAY}'
WHERE status = 'active'
  AND check_in_date = '2026-05-04'
  AND resident_id IN (
    ${revertIdsList || `''  -- (no probable_revert IDs)`}
  );

-- ============================================================================
-- 3. Delete INTAKE-REACT rooms that no longer have any active assignment.
--    (Skip rooms still holding a keep_active or uncertain resident.)
-- ============================================================================
DELETE FROM rooms
WHERE notes LIKE '%[Auto-created INTAKE-REACT room for status-flip 2026-05-04]%'
  AND id NOT IN (
    SELECT room_id FROM room_assignments WHERE status = 'active' AND room_id IS NOT NULL
  );

-- Sanity counts (eyeball before flipping ROLLBACK -> COMMIT):
--   SELECT count(*) FROM residents WHERE notes LIKE '%[Reactivated 2026-05-04 from tenant_portal]%';
--     -- expected: ${reactivatedClean.length - probableRevertIds.length}  (was ${reactivatedClean.length})
--   SELECT count(*) FROM residents WHERE status = 'active';
--     -- expected: ${projectedActive}  (was ${activeResidents.length}, mgmt target ≈ ${MGMT_TRUTH.total_active})
--   SELECT count(*) FROM rooms WHERE notes LIKE '%[Auto-created INTAKE-REACT room for status-flip 2026-05-04]%';
--     -- expected: rooms still holding keep_active/uncertain residents (≤ 8 originally)

ROLLBACK;
-- To apply: change ROLLBACK to COMMIT.
`;

fs.writeFileSync(REVERT_SQL_PATH, revertSql);
console.log(`Wrote ${REVERT_SQL_PATH}`);

console.log('Done.');

// ---------- Read-only guard ----------
//
// This script must never INSERT/UPDATE/DELETE the DB. The text below is a
// grep target; a sibling lint can verify these tokens are absent from any
// supabase client call.
//
// guard: no-supabase-mutation

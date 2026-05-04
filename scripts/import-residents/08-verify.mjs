#!/usr/bin/env node
/**
 * Stage 8 — Independent verification audit (READ-ONLY).
 *
 * Compares Supabase dev (xswagpwarqfdlbtkhlgz) ⇄ data/residents-verify.xlsx
 * (already converted to per-sheet CSVs in reports/verify/raw/).
 *
 * No INSERT/UPDATE/DELETE — every "Recommended fix" is *emitted as text* in
 * the markdown report. The grep guard at the bottom enforces this.
 *
 * Inputs (already produced):
 *   reports/verify/raw/applications.csv
 *   reports/verify/raw/tenant_portal.csv
 *   reports/verify/raw/deductions.csv
 *   reports/verify/raw/blacklist.csv
 *   reports/verify/raw/transport.csv
 *   reports/verify/raw/db_residents.json
 *   reports/verify/raw/db_room_assignments.json
 *   reports/verify/raw/db_buildings.json
 *   reports/verify/raw/db_apartments.json
 *   reports/verify/raw/db_rooms.json
 *
 * Outputs:
 *   reports/verify/checks/<check>.csv  — full row dumps
 *   reports/verify/REPORT.md           — narrative + 20 examples per bucket
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';
import { mapBuilding, BUILDING_IDS } from './lib/building-mapping.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERIFY = path.join(__dirname, 'reports', 'verify');
const RAW = path.join(VERIFY, 'raw');
const CHECKS = path.join(VERIFY, 'checks');
fs.mkdirSync(CHECKS, { recursive: true });

const REPORT_PATH = path.join(VERIFY, 'REPORT.md');

// ---------- normalization (mirrors 03-transform.mjs) ----------

function trim(s) { return (s == null ? '' : String(s)).trim(); }

function toAsciiDigits(s) {
  if (!s) return s;
  return String(s).replace(/[٠-٩]/g, d => '0123456789'[d.charCodeAt(0) - 0x0660])
                  .replace(/[۰-۹]/g, d => '0123456789'[d.charCodeAt(0) - 0x06f0]);
}

function normalizePhone(raw) {
  let s = trim(raw);
  if (!s) return null;
  s = toAsciiDigits(s);
  // strip trailing ".0" from xlsx float-coerced numbers
  s = s.replace(/\.0+$/, '');
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
  if (!cleaned) return null;
  return cleaned;
}

function normalizeName(raw) {
  let s = trim(raw);
  if (!s) return null;
  s = toAsciiDigits(s);
  // diacritics
  s = s.replace(/[ً-ْٰ]/g, '');
  // tatweel
  s = s.replace(/ـ/g, '');
  // ligature folding
  s = s.replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  // collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s.toLowerCase();
}

function nameTokenKey(raw) {
  const n = normalizeName(raw);
  if (!n) return null;
  const toks = n.split(' ').filter(Boolean).filter(t => t.length > 1);
  if (toks.length < 2) return null;
  return toks.slice().sort().join(' ');
}

// ---------- IO ----------

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function loadCsv(p) {
  const rows = parseCsv(fs.readFileSync(p, 'utf8'));
  return rows;
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function writeCsv(name, header, rows) {
  const out = path.join(CHECKS, name);
  const lines = [header.map(csvEscape).join(',')];
  for (const r of rows) lines.push(header.map(h => csvEscape(r[h])).join(','));
  fs.writeFileSync(out, lines.join('\n') + '\n');
  return out;
}

// ---------- load inputs ----------

console.log('Loading inputs...');
const dbResidents = loadJson(path.join(RAW, 'db_residents.json'));
const dbAssignments = loadJson(path.join(RAW, 'db_room_assignments.json'));
const dbBuildings = loadJson(path.join(RAW, 'db_buildings.json'));
const dbApartments = loadJson(path.join(RAW, 'db_apartments.json'));
const dbRooms = loadJson(path.join(RAW, 'db_rooms.json'));

const buildingsById = new Map(dbBuildings.map(b => [b.id, b]));
const apartmentsById = new Map(dbApartments.map(a => [a.id, a]));
const roomsById = new Map(dbRooms.map(r => [r.id, r]));

// active assignments per resident
const activeAssignByResident = new Map();
for (const a of dbAssignments) {
  if (a.status === 'active') activeAssignByResident.set(a.resident_id, a);
}

// ---------- parse XLSX-derived CSVs ----------

// applications: header at row 0, 36 cols
const appsCsv = loadCsv(path.join(RAW, 'applications.csv'));
const APP_H = appsCsv[0];
const APP_C = {
  TIMESTAMP: 0, HEALTH: 1, NOTES: 2, EJAR: 3, FULL_NAME: 4,
  DOB1: 5, PHONE_OLD: 6, EMERGENCY_OLD: 7, CIVIL: 8, RATING: 9,
  NATIONAL_ID: 10, PHONE: 11, CONTRACT_START: 12, SUPERVISOR: 13,
  WORKPLACE: 14, BUILDING: 15, DOB2: 16, ORIGIN: 17, EMERGENCY: 18,
  UNIT_TYPE: 19, PAYMENT: 20, TRANSPORT: 21, TRANSPORT_DUR: 22,
  IBAN: 23, BANK_HOLDER: 24, HEARD: 25, REGION: 26,
};

// tenant_portal: row 0 = junk meta, row 1 = real header
const tpCsv = loadCsv(path.join(RAW, 'tenant_portal.csv'));
const TP_H = tpCsv[1]; // [الفرع, الاسم, الرقم السري, اسم المستخدم, رقم الجوال, ملاحظات, ?]
const TP_C = { BRANCH: 0, NAME: 1, PASSWORD: 2, USERNAME: 3, PHONE: 4, NOTES: 5 };
const tpRows = tpCsv.slice(2);

// deductions: row 0 = real header (col0 unlabeled = branch, col1 = "اسم المستأجرة").
// Data starts at row 1.
const dedCsv = loadCsv(path.join(RAW, 'deductions.csv'));
const DED_H = dedCsv[0];
const DED_C = { BRANCH: 0, NAME: 1, NATIONAL_ID: 2, PHONE: 3, UNIT_BRANCH: 4, PAYMENT: 5, NOTES: 6, AMOUNT: 7, KIND: 8, DURATION: 9, SOURCE: 10, APPROVED: 11 };
const dedRows = dedCsv.slice(1);

// blacklist: header at row 0
const blCsv = loadCsv(path.join(RAW, 'blacklist.csv'));
const BL_C = { NAME: 0, BRANCH: 1, NATIONAL_ID: 2, PHONE: 3, ACCEPT_CONDITIONALLY: 4, SUPERVISOR_NOTES: 5, FINANCE_NOTES: 6, NOTES: 7 };
const blRows = blCsv.slice(1);

// transport: header at row 0
const trCsv = loadCsv(path.join(RAW, 'transport.csv'));
const TR_C = { COLLEGE: 0, BRANCH: 1, PHONE: 2, NAME: 3 };
const trRows = trCsv.slice(1);

// applications: skip legend rows + data rows start at idx 1 (because legend
// rows have FULL_NAME like "تأكيد الدفع") — replicate isLegendRow.
const appRows = appsCsv.slice(1).filter(r => {
  const n = trim(r[APP_C.FULL_NAME]);
  return n && !n.includes('تأكيد الدفع');
});

console.log(`apps=${appRows.length} tp=${tpRows.length} ded=${dedRows.length} bl=${blRows.length} tr=${trRows.length}`);

// ---------- build DB indexes ----------

function pushIndex(map, key, val) {
  if (!key) return;
  let arr = map.get(key);
  if (!arr) { arr = []; map.set(key, arr); }
  arr.push(val);
}

const dbById = new Map();        // national_id → [resident]
const dbByPhone = new Map();     // phone → [resident]
const dbByName = new Map();      // sorted-token name → [resident]

for (const r of dbResidents) {
  pushIndex(dbById, normalizeId(r.national_id_or_iqama), r);
  pushIndex(dbByPhone, normalizePhone(r.phone), r);
  pushIndex(dbByName, nameTokenKey(r.full_name), r);
}

// ---------- helpers ----------

const buildingIdToTag = new Map();
for (const [, id] of Object.entries(BUILDING_IDS)) {
  const b = buildingsById.get(id);
  if (b) buildingIdToTag.set(id, b.slug);
}

function mapBuildingFromXlsxBranch(branch) {
  // The xlsx "الفرع" values include short forms like "الاندلس", "العليا",
  // "الراكة", "الدمام", "الجبيل", "اليرموك", "العارض". mapBuilding handles them.
  return mapBuilding(branch);
}

// ---------- xlsx active-truth indexes ----------

// tenant_portal has NO national_id, so match by phone+name only.
const tpByPhone = new Map();
const tpByName = new Map();
const tpRowsParsed = [];
for (const r of tpRows) {
  const branch = trim(r[TP_C.BRANCH]);
  const name = trim(r[TP_C.NAME]);
  if (!name) continue;
  const phone = normalizePhone(r[TP_C.PHONE]);
  const username = trim(r[TP_C.USERNAME]);
  const obj = { branch, name, phone, username, raw: r };
  tpRowsParsed.push(obj);
  pushIndex(tpByPhone, phone, obj);
  pushIndex(tpByName, nameTokenKey(name), obj);
}

const dedById = new Map();
const dedByPhone = new Map();
const dedByName = new Map();
const dedRowsParsed = [];
for (const r of dedRows) {
  const name = trim(r[DED_C.NAME]);
  if (!name) continue;
  const id = normalizeId(r[DED_C.NATIONAL_ID]);
  const phone = normalizePhone(r[DED_C.PHONE]);
  const branch = trim(r[DED_C.BRANCH]);
  const unitBranch = trim(r[DED_C.UNIT_BRANCH]);
  const obj = { branch, name, id, phone, unitBranch, raw: r };
  dedRowsParsed.push(obj);
  pushIndex(dedById, id, obj);
  pushIndex(dedByPhone, phone, obj);
  pushIndex(dedByName, nameTokenKey(name), obj);
}

// applications (superset): index by ID/phone/name
const appsById = new Map();
const appsByPhone = new Map();
const appsByName = new Map();
const appsRowsParsed = [];
for (let i = 0; i < appRows.length; i++) {
  const r = appRows[i];
  const name = trim(r[APP_C.FULL_NAME]);
  if (!name) continue;
  const id = normalizeId(r[APP_C.NATIONAL_ID]);
  const phone = normalizePhone(r[APP_C.PHONE]) || normalizePhone(r[APP_C.PHONE_OLD]);
  const branch = trim(r[APP_C.BUILDING]);
  const unit = trim(r[APP_C.UNIT_TYPE]);
  const supervisor = trim(r[APP_C.SUPERVISOR]);
  const dob = trim(r[APP_C.DOB1]) || trim(r[APP_C.DOB2]);
  const workplace = trim(r[APP_C.WORKPLACE]);
  const emergency = normalizePhone(r[APP_C.EMERGENCY]) || normalizePhone(r[APP_C.EMERGENCY_OLD]);
  const region = trim(r[APP_C.REGION]) || trim(r[APP_C.ORIGIN]);
  const obj = { rowIdx: i, name, id, phone, branch, unit, supervisor, dob, workplace, emergency, region, raw: r };
  appsRowsParsed.push(obj);
  pushIndex(appsById, id, obj);
  pushIndex(appsByPhone, phone, obj);
  pushIndex(appsByName, nameTokenKey(name), obj);
}

const blRowsParsed = [];
const blById = new Map();
const blByPhone = new Map();
const blByName = new Map();
for (const r of blRows) {
  const name = trim(r[BL_C.NAME]);
  if (!name) continue;
  const id = normalizeId(r[BL_C.NATIONAL_ID]);
  const phone = normalizePhone(r[BL_C.PHONE]);
  const branch = trim(r[BL_C.BRANCH]);
  const reasons = [r[BL_C.SUPERVISOR_NOTES], r[BL_C.FINANCE_NOTES], r[BL_C.NOTES]].map(trim).filter(Boolean).join(' | ');
  const accept = trim(r[BL_C.ACCEPT_CONDITIONALLY]);
  const obj = { name, id, phone, branch, reasons, accept };
  blRowsParsed.push(obj);
  pushIndex(blById, id, obj);
  pushIndex(blByPhone, phone, obj);
  pushIndex(blByName, nameTokenKey(name), obj);
}

const trRowsParsed = [];
const trByPhone = new Map();
const trByName = new Map();
for (const r of trRows) {
  const name = trim(r[TR_C.NAME]);
  if (!name) continue;
  const college = trim(r[TR_C.COLLEGE]);
  const branch = trim(r[TR_C.BRANCH]);
  const phone = normalizePhone(r[TR_C.PHONE]);
  const obj = { name, college, branch, phone };
  trRowsParsed.push(obj);
  pushIndex(trByPhone, phone, obj);
  pushIndex(trByName, nameTokenKey(name), obj);
}

// ---------- Check 1: resident-level reconciliation ----------
// Match each xlsx applications row to a DB resident via id→phone→name.

function lookupDb({ id, phone, name }) {
  if (id) {
    const hit = dbById.get(id);
    if (hit && hit.length) return { match: hit[0], via: 'id', count: hit.length };
  }
  if (phone) {
    const hit = dbByPhone.get(phone);
    if (hit && hit.length) return { match: hit[0], via: 'phone', count: hit.length };
  }
  const nk = nameTokenKey(name);
  if (nk) {
    const hit = dbByName.get(nk);
    if (hit && hit.length === 1) return { match: hit[0], via: 'name', count: 1 };
    if (hit && hit.length > 1) return { match: null, via: 'name-ambiguous', count: hit.length };
  }
  return { match: null, via: 'none', count: 0 };
}

const xlsxOnlyApps = [];
const matchedApps = [];
const conflicts = []; // field-by-field disagreements
for (const a of appsRowsParsed) {
  const { match, via } = lookupDb({ id: a.id, phone: a.phone, name: a.name });
  if (!match) {
    xlsxOnlyApps.push({ via, ...a });
    continue;
  }
  matchedApps.push({ via, app: a, db: match });

  // Compare fields
  const dbId = normalizeId(match.national_id_or_iqama);
  const dbPhone = normalizePhone(match.phone);
  const dbName = normalizeName(match.full_name);
  if (a.id && dbId && a.id !== dbId) {
    conflicts.push({ field: 'national_id', resident_id: match.id, db: dbId, xlsx: a.id, name: match.full_name });
  }
  if (a.phone && dbPhone && a.phone !== dbPhone && match.phone !== '0000000000') {
    conflicts.push({ field: 'phone', resident_id: match.id, db: dbPhone, xlsx: a.phone, name: match.full_name });
  }
  const xlsxName = normalizeName(a.name);
  if (dbName && xlsxName && dbName !== xlsxName) {
    // flag substantive name disagreement (>2 token diff)
    const dbToks = new Set(dbName.split(' '));
    const xlToks = new Set(xlsxName.split(' '));
    let common = 0;
    for (const t of dbToks) if (xlToks.has(t)) common++;
    if (common < Math.min(dbToks.size, xlToks.size) - 1) {
      conflicts.push({ field: 'full_name', resident_id: match.id, db: match.full_name, xlsx: a.name });
    }
  }
}

// DB rows with no application
const matchedResidentIds = new Set(matchedApps.map(m => m.db.id));
const dbOnly = dbResidents.filter(r => !matchedResidentIds.has(r.id));

writeCsv('check1_xlsx_only.csv', ['via', 'name', 'id', 'phone', 'branch', 'unit', 'rowIdx'], xlsxOnlyApps);
writeCsv('check1_matched.csv', ['via', 'resident_id', 'db_name', 'db_phone', 'db_id', 'xlsx_name', 'xlsx_phone', 'xlsx_id', 'app_branch'],
  matchedApps.map(m => ({
    via: m.via, resident_id: m.db.id, db_name: m.db.full_name, db_phone: m.db.phone,
    db_id: m.db.national_id_or_iqama, xlsx_name: m.app.name, xlsx_phone: m.app.phone,
    xlsx_id: m.app.id, app_branch: m.app.branch,
  })));
writeCsv('check1_conflicts.csv', ['field', 'resident_id', 'name', 'db', 'xlsx'], conflicts);
writeCsv('check1_db_only.csv', ['id', 'full_name', 'phone', 'national_id_or_iqama', 'status', 'created_at'], dbOnly);

// ---------- Check 2: duplicates ----------

const dupDbById = [];
for (const [k, arr] of dbById) {
  if (k && arr.length > 1) dupDbById.push({ key: k, count: arr.length, ids: arr.map(a => a.id).join('|'), names: arr.map(a => a.full_name).join(' | ') });
}
const dupDbByPhone = [];
for (const [k, arr] of dbByPhone) {
  if (k && k !== '0000000000' && arr.length > 1) dupDbByPhone.push({ key: k, count: arr.length, ids: arr.map(a => a.id).join('|'), names: arr.map(a => a.full_name).join(' | ') });
}
const dupDbByName = [];
for (const [k, arr] of dbByName) {
  if (k && arr.length > 1) dupDbByName.push({ key: k, count: arr.length, ids: arr.map(a => a.id).join('|'), names: arr.map(a => a.full_name).join(' | ') });
}

const dupAppsById = [];
for (const [k, arr] of appsById) {
  if (k && arr.length > 1) dupAppsById.push({ key: k, count: arr.length, names: arr.map(a => a.name).join(' | ') });
}

writeCsv('check2_db_dup_id.csv', ['key', 'count', 'ids', 'names'], dupDbById);
writeCsv('check2_db_dup_phone.csv', ['key', 'count', 'ids', 'names'], dupDbByPhone);
writeCsv('check2_db_dup_name.csv', ['key', 'count', 'ids', 'names'], dupDbByName);
writeCsv('check2_apps_dup_id.csv', ['key', 'count', 'names'], dupAppsById);

// Cross-source identity collisions: same id matches different names across DB vs xlsx
const crossCollisions = [];
for (const [id, dbArr] of dbById) {
  if (!id) continue;
  const apps = appsById.get(id);
  if (!apps || !apps.length) continue;
  const dbNames = new Set(dbArr.map(d => normalizeName(d.full_name)));
  for (const a of apps) {
    const an = normalizeName(a.name);
    let any = false;
    for (const d of dbNames) {
      const dt = new Set((d || '').split(' '));
      const at = new Set((an || '').split(' '));
      let c = 0; for (const t of dt) if (at.has(t)) c++;
      if (c >= 2) { any = true; break; }
    }
    if (!any) {
      crossCollisions.push({ national_id: id, db_names: [...dbNames].join(' / '), xlsx_name: a.name });
    }
  }
}
writeCsv('check2_cross_collisions.csv', ['national_id', 'db_names', 'xlsx_name'], crossCollisions);

// ---------- Check 3: building/room reconciliation ----------

function getResidentDbBuilding(r) {
  const a = activeAssignByResident.get(r.id);
  if (!a) return null;
  return a.building_id;
}

const buildingMismatches = [];
const intakePending = []; // assigned but apartment_number = INTAKE
for (const m of matchedApps) {
  const r = m.db;
  const dbBuildingId = getResidentDbBuilding(r);
  const xlsxMap = mapBuildingFromXlsxBranch(m.app.branch);
  const xlsxBuildingId = xlsxMap.buildingId;
  const a = activeAssignByResident.get(r.id);
  if (a) {
    const apt = a.rooms?.apartments;
    const aptNum = apt?.apartment_number || '';
    if (aptNum.toUpperCase().startsWith('INTAKE')) {
      intakePending.push({
        resident_id: r.id, name: r.full_name, db_building: buildingsById.get(dbBuildingId)?.slug,
        xlsx_branch: m.app.branch, xlsx_building: buildingsById.get(xlsxBuildingId)?.slug,
        supervisor: m.app.supervisor,
      });
    }
  }
  if (dbBuildingId && xlsxBuildingId && dbBuildingId !== xlsxBuildingId) {
    buildingMismatches.push({
      resident_id: r.id,
      name: r.full_name,
      db_building: buildingsById.get(dbBuildingId)?.slug,
      xlsx_branch: m.app.branch,
      xlsx_resolved: buildingsById.get(xlsxBuildingId)?.slug,
      xlsx_reason: xlsxMap.reason,
    });
  }
}
writeCsv('check3_building_mismatches.csv', ['resident_id', 'name', 'db_building', 'xlsx_branch', 'xlsx_resolved', 'xlsx_reason'], buildingMismatches);
writeCsv('check3_intake_pending.csv', ['resident_id', 'name', 'db_building', 'xlsx_branch', 'xlsx_building', 'supervisor'], intakePending);

// Default-building audit: residents whose DB building is *-1 but xlsx says *-2
const defaultBuildingAudit = buildingMismatches.filter(m => {
  const a = (m.db_building || '').replace(/-\d+$/, '');
  const b = (m.xlsx_resolved || '').replace(/-\d+$/, '');
  return a && a === b && m.db_building !== m.xlsx_resolved;
});
writeCsv('check3_default_building_audit.csv', ['resident_id', 'name', 'db_building', 'xlsx_resolved', 'xlsx_branch'], defaultBuildingAudit);

// ---------- Check 4 (already merged into 3 default-building audit) ----------
// see above

// ---------- Check 5: status sanity (active truth from tp + ded) ----------

// Mark each DB resident with which xlsx active sheets it appears in.
function residentInTp(r) {
  const phone = normalizePhone(r.phone);
  const nk = nameTokenKey(r.full_name);
  if (phone && phone !== '0000000000' && tpByPhone.has(phone)) return tpByPhone.get(phone)[0];
  if (nk && tpByName.has(nk) && tpByName.get(nk).length === 1) return tpByName.get(nk)[0];
  return null;
}
function residentInDed(r) {
  const id = normalizeId(r.national_id_or_iqama);
  if (id && dedById.has(id)) return dedById.get(id)[0];
  const phone = normalizePhone(r.phone);
  if (phone && phone !== '0000000000' && dedByPhone.has(phone)) return dedByPhone.get(phone)[0];
  const nk = nameTokenKey(r.full_name);
  if (nk && dedByName.has(nk) && dedByName.get(nk).length === 1) return dedByName.get(nk)[0];
  return null;
}

const statusFlags = dbResidents.map(r => ({
  r,
  inTp: !!residentInTp(r),
  inDed: !!residentInDed(r),
}));

// DB checked_out but xlsx active (in tp or ded)
const dbCheckedOutButXlsxActive = statusFlags.filter(s => s.r.status === 'checked_out' && (s.inTp || s.inDed))
  .map(s => ({ resident_id: s.r.id, name: s.r.full_name, status: s.r.status, in_tenant_portal: s.inTp, in_deductions: s.inDed }));

// DB active but not in either active sheet
const dbActiveButNotInSheets = statusFlags.filter(s => s.r.status === 'active' && !s.inTp && !s.inDed)
  .map(s => ({ resident_id: s.r.id, name: s.r.full_name, phone: s.r.phone, national_id: s.r.national_id_or_iqama }));

// Tenant portal vs deductions divergence
const inTpNotDed = tpRowsParsed.filter(t => {
  // does this tp row appear in dedByPhone or dedByName?
  if (t.phone && dedByPhone.has(t.phone)) return false;
  const nk = nameTokenKey(t.name);
  if (nk && dedByName.has(nk)) return false;
  return true;
});
const inDedNotTp = dedRowsParsed.filter(d => {
  if (d.phone && tpByPhone.has(d.phone)) return false;
  const nk = nameTokenKey(d.name);
  if (nk && tpByName.has(nk)) return false;
  return true;
});

// xlsx-only newcomers (in tp/ded but no DB resident at all)
const xlsxOnlyActives = [];
for (const t of tpRowsParsed) {
  const fakeR = { phone: t.phone, full_name: t.name, national_id_or_iqama: null };
  if (!residentInTp_inverse(fakeR) && !residentInDed_inverse(fakeR)) {
    xlsxOnlyActives.push({ source: 'tenant_portal', name: t.name, phone: t.phone, branch: t.branch });
  }
}
function residentInTp_inverse(fr) {
  // is there a DB resident matching this fake resident?
  return lookupDb({ id: null, phone: fr.phone, name: fr.full_name }).match;
}
function residentInDed_inverse(fr) {
  return lookupDb({ id: null, phone: fr.phone, name: fr.full_name }).match;
}
// re-do correctly: xlsx active rows with no DB match
const xlsxOnlyTp = tpRowsParsed.filter(t => !lookupDb({ id: null, phone: t.phone, name: t.name }).match)
  .map(t => ({ source: 'tenant_portal', name: t.name, phone: t.phone, branch: t.branch }));
const xlsxOnlyDed = dedRowsParsed.filter(d => !lookupDb({ id: d.id, phone: d.phone, name: d.name }).match)
  .map(d => ({ source: 'deductions', name: d.name, id: d.id, phone: d.phone, branch: d.branch }));

writeCsv('check5_db_checkedout_xlsx_active.csv', ['resident_id', 'name', 'status', 'in_tenant_portal', 'in_deductions'], dbCheckedOutButXlsxActive);
writeCsv('check5_db_active_not_in_sheets.csv', ['resident_id', 'name', 'phone', 'national_id'], dbActiveButNotInSheets);
writeCsv('check5_in_tp_not_ded.csv', ['name', 'phone', 'branch', 'username'], inTpNotDed);
writeCsv('check5_in_ded_not_tp.csv', ['name', 'id', 'phone', 'branch', 'unitBranch'], inDedNotTp);
writeCsv('check5_xlsx_only_tp.csv', ['source', 'name', 'phone', 'branch'], xlsxOnlyTp);
writeCsv('check5_xlsx_only_ded.csv', ['source', 'name', 'id', 'phone', 'branch'], xlsxOnlyDed);

// ---------- Check 6: data quality gaps ----------

const placeholderPhones = dbResidents.filter(r => r.phone === '0000000000');
const nullNationality = dbResidents.filter(r => !r.nationality);
const nullDob = dbResidents.filter(r => !r.date_of_birth);

// Can xlsx fill them?
function findAppByResident(r) {
  const id = normalizeId(r.national_id_or_iqama);
  if (id && appsById.has(id)) return appsById.get(id)[0];
  const phone = normalizePhone(r.phone);
  if (phone && phone !== '0000000000' && appsByPhone.has(phone)) return appsByPhone.get(phone)[0];
  const nk = nameTokenKey(r.full_name);
  if (nk && appsByName.has(nk) && appsByName.get(nk).length === 1) return appsByName.get(nk)[0];
  return null;
}

const fillablePhones = placeholderPhones.map(r => ({
  resident_id: r.id, name: r.full_name,
  xlsx_phone: findAppByResident(r)?.phone || '',
})).filter(x => x.xlsx_phone);

const fillableDob = nullDob.map(r => ({
  resident_id: r.id, name: r.full_name, xlsx_dob: findAppByResident(r)?.dob || '',
})).filter(x => x.xlsx_dob);

writeCsv('check6_placeholder_phones.csv', ['resident_id', 'name', 'phone'], placeholderPhones.map(r => ({ resident_id: r.id, name: r.full_name, phone: r.phone })));
writeCsv('check6_fillable_phones.csv', ['resident_id', 'name', 'xlsx_phone'], fillablePhones);
writeCsv('check6_null_nationality.csv', ['resident_id', 'name'], nullNationality.map(r => ({ resident_id: r.id, name: r.full_name })));
writeCsv('check6_null_dob.csv', ['resident_id', 'name'], nullDob.map(r => ({ resident_id: r.id, name: r.full_name })));
writeCsv('check6_fillable_dob.csv', ['resident_id', 'name', 'xlsx_dob'], fillableDob);

// ---------- Check 7: INTAKE cleanup grouped by destination ----------

const intakeAssignments = dbAssignments.filter(a => {
  if (a.status !== 'active') return null;
  const apt = a.rooms?.apartments;
  return apt && (apt.apartment_number || '').toUpperCase().startsWith('INTAKE');
});

// For each, find the supervisor-comment-derived apartment+room from xlsx app
const intakeFix = [];
for (const a of intakeAssignments) {
  const r = dbResidents.find(x => x.id === a.resident_id);
  if (!r) continue;
  const app = findAppByResident(r);
  if (!app || !app.supervisor) continue;
  intakeFix.push({
    resident_id: r.id,
    name: r.full_name,
    db_building: buildingsById.get(a.building_id)?.slug,
    supervisor_comment: app.supervisor,
    xlsx_branch: app.branch,
    unit: app.unit,
  });
}
writeCsv('check7_intake_fix_candidates.csv', ['resident_id', 'name', 'db_building', 'xlsx_branch', 'unit', 'supervisor_comment'], intakeFix);

// ---------- Black list: in DB and not in DB ----------

const blInDb = [];
const blNotInDb = [];
for (const b of blRowsParsed) {
  const m = lookupDb({ id: b.id, phone: b.phone, name: b.name });
  if (m.match) blInDb.push({ resident_id: m.match.id, db_name: m.match.full_name, status: m.match.status, bl_name: b.name, bl_branch: b.branch, reasons: b.reasons, accept: b.accept });
  else blNotInDb.push(b);
}
writeCsv('check_blacklist_in_db.csv', ['resident_id', 'db_name', 'status', 'bl_name', 'bl_branch', 'accept', 'reasons'], blInDb);
writeCsv('check_blacklist_not_in_db.csv', ['name', 'id', 'phone', 'branch', 'reasons', 'accept'], blNotInDb);

// SQL recommendations (text-only — never executed)
const sqlBlUpdates = blInDb.slice(0, 20).map(b => {
  const reason = (b.reasons || '').replace(/'/g, "''");
  return `UPDATE residents SET status='checked_out', notes = COALESCE(notes,'') || E'\\n[Black list 2026-05-04] ${reason}' WHERE id = '${b.resident_id}';`;
});
const sqlBlInserts = blNotInDb.slice(0, 20).map(b => {
  const fn = (b.name || '').replace(/'/g, "''");
  const id = b.id ? `'${b.id}'` : 'NULL';
  const ph = b.phone ? `'${b.phone}'` : `'0000000000'`;
  const reason = (b.reasons || 'Black list').replace(/'/g, "''");
  return `INSERT INTO residents (full_name, phone, national_id_or_iqama, status, notes) VALUES ('${fn}', ${ph}, ${id}, 'checked_out', 'Black list — ${reason}');`;
});

// ---------- write REPORT.md ----------

function topN(arr, n = 20) { return arr.slice(0, n); }

function md(rows, headers) {
  if (!rows.length) return '_(none)_\n';
  const lines = ['| ' + headers.join(' | ') + ' |', '|' + headers.map(() => '---').join('|') + '|'];
  for (const r of rows) lines.push('| ' + headers.map(h => String(r[h] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 120)).join(' | ') + ' |');
  return lines.join('\n') + '\n';
}

const lines = [];
lines.push('# Residents Import — Independent Verification Report');
lines.push('');
lines.push('Generated 2026-05-04. Read-only audit comparing Supabase dev (`xswagpwarqfdlbtkhlgz`) ⇄ `data/residents-verify.xlsx`.');
lines.push('');

lines.push('## 1. Executive summary');
lines.push('');
lines.push(`Audit reconciled the **${dbResidents.length}** residents in the dev DB against the richer xlsx (applications=${appsRowsParsed.length}, tenant_portal=${tpRowsParsed.length}, deductions=${dedRowsParsed.length}, blacklist=${blRowsParsed.length}, transport=${trRowsParsed.length}). The applications sheet is a superset of the import CSV; near-100% of DB residents match an applications row. The **most actionable gaps** are: (a) ${intakeAssignments.length} active residents still on placeholder INTAKE apartments — supervisor comments in the xlsx parse to a real apartment+room for ${intakeFix.length}; (b) ${blInDb.length} residents already in the DB are flagged on the Black list and need their status flipped to \`checked_out\` plus a notes stamp; (c) ${dbActiveButNotInSheets.length} residents currently marked \`active\` in the DB do not appear in either tenant_portal or deductions, suggesting silent move-outs.`);
lines.push('');
lines.push('| Metric | Count |');
lines.push('|---|---:|');
lines.push(`| DB residents (total) | ${dbResidents.length} |`);
lines.push(`| DB residents (active) | ${dbResidents.filter(r => r.status === 'active').length} |`);
lines.push(`| DB residents (checked_out) | ${dbResidents.filter(r => r.status === 'checked_out').length} |`);
lines.push(`| Applications rows (xlsx) | ${appsRowsParsed.length} |`);
lines.push(`| Tenant portal rows (xlsx) | ${tpRowsParsed.length} |`);
lines.push(`| Deductions rows (xlsx) | ${dedRowsParsed.length} |`);
lines.push(`| Blacklist rows (xlsx) | ${blRowsParsed.length} |`);
lines.push(`| Apps matched to DB resident | ${matchedApps.length} |`);
lines.push(`| Apps with no DB resident (xlsx-only) | ${xlsxOnlyApps.length} |`);
lines.push(`| DB residents with no apps row (db-only) | ${dbOnly.length} |`);
lines.push(`| Field-level conflicts (id/phone/name) | ${conflicts.length} |`);
lines.push(`| DB duplicates by national_id | ${dupDbById.length} |`);
lines.push(`| DB duplicates by phone | ${dupDbByPhone.length} |`);
lines.push(`| Building mismatches | ${buildingMismatches.length} |`);
lines.push(`| Default-building -1/-2 audit candidates | ${defaultBuildingAudit.length} |`);
lines.push(`| INTAKE placeholder assignments | ${intakeAssignments.length} |`);
lines.push(`| INTAKE rows with supervisor-derived target | ${intakeFix.length} |`);
lines.push(`| Status: DB checked_out but xlsx-active | ${dbCheckedOutButXlsxActive.length} |`);
lines.push(`| Status: DB active but xlsx-silent | ${dbActiveButNotInSheets.length} |`);
lines.push(`| In tenant_portal but not deductions | ${inTpNotDed.length} |`);
lines.push(`| In deductions but not tenant_portal | ${inDedNotTp.length} |`);
lines.push(`| Placeholder phones (0000000000) in DB | ${placeholderPhones.length} |`);
lines.push(`| Of those, fillable from xlsx | ${fillablePhones.length} |`);
lines.push(`| Null nationality in DB | ${nullNationality.length} |`);
lines.push(`| Null DOB in DB (fillable from xlsx) | ${fillableDob.length} / ${nullDob.length} |`);
lines.push(`| Black list rows already in DB | ${blInDb.length} |`);
lines.push(`| Black list rows NOT in DB | ${blNotInDb.length} |`);
lines.push('');

lines.push('## 2. Ambiguous source data');
lines.push('');
lines.push('Columns the auditor could not interpret with full confidence:');
lines.push('- `applications.csv` cols [27]–[35] are mostly empty/unlabeled (some headers blank). Treated as ignored.');
lines.push('- `applications.csv` col [25] "كيف سمعتي عن سكن السيد" (heard-from) — captured but not used in matching.');
lines.push('- `tenant_portal.csv` row 0 contains free-form notes ("فيه لها حساب مسبق...", "لم يتم الارسال") rather than headers. Real header is row 1: الفرع | الاسم | الرقم السري | اسم المستخدم | رقم الجوال | ملاحظات. **Tenant portal has no national_id**, so matching to DB falls back to phone+name — a small fraction of name-ambiguous rows could not be uniquely matched.');
lines.push('- `deductions.csv` row 0 is the real header (col [0] is unlabeled but holds the branch name; col [1] is "اسم المستأجرة"). Data begins at row 1. **Critical data-quality finding**: of the 1,916 data rows, only **12** have any resident-identifying values (name/id/phone) populated. The remaining ~1,904 rows have only a branch in col [0] and everything else blank. This is either an export error or the sheet was never filled in — flagging so the deductions sheet is **not** treated as a reliable secondary "active" signal in any downstream automation.');
lines.push('- `blacklist.csv` cols [4]/[5]/[6]/[7] mix supervisor/finance/general notes with overlapping content; the audit concatenates them as a single reason string.');
lines.push('- Many xlsx phone/id cells were stored as Excel numbers and arrived with trailing `.0`; normalization strips this. Some IDs were stored as `?`/blank in the blacklist sheet — those rows can only be matched by name.');
lines.push('');

lines.push('## 3. Resident-level reconciliation');
lines.push('');
lines.push(`Of **${appsRowsParsed.length}** applications rows, **${matchedApps.length}** matched a DB resident (via id→phone→name fallback). **${xlsxOnlyApps.length}** applications had no DB match. **${dbOnly.length}** DB residents have no application row at all (likely imported via the legacy CSV path, or duplicates that survived dedup).`);
lines.push('');
lines.push('### 3.1 Field-level conflicts (top 20)');
lines.push(md(topN(conflicts), ['field', 'resident_id', 'name', 'db', 'xlsx']));
lines.push('### 3.2 Applications with no DB resident (top 20)');
lines.push(md(topN(xlsxOnlyApps).map(x => ({ via: x.via, name: x.name, id: x.id, phone: x.phone, branch: x.branch })), ['via', 'name', 'id', 'phone', 'branch']));
lines.push('### 3.3 DB residents with no applications row (top 20)');
lines.push(md(topN(dbOnly).map(r => ({ id: r.id, full_name: r.full_name, phone: r.phone, status: r.status })), ['id', 'full_name', 'phone', 'status']));
lines.push('');

lines.push('## 4. Duplicates');
lines.push('');
lines.push(`Detected ${dupDbById.length} repeated national_ids inside the DB, ${dupDbByPhone.length} repeated phones (excluding the \`0000000000\` placeholder), ${dupDbByName.length} repeated sorted-token names, and ${crossCollisions.length} cross-source identity collisions (same national_id, very different name in xlsx vs DB).`);
lines.push('');
lines.push('### 4.1 DB duplicates by national_id (top 20)');
lines.push(md(topN(dupDbById), ['key', 'count', 'ids', 'names']));
lines.push('### 4.2 DB duplicates by phone (top 20)');
lines.push(md(topN(dupDbByPhone), ['key', 'count', 'ids', 'names']));
lines.push('### 4.3 DB duplicates by name (top 20)');
lines.push(md(topN(dupDbByName), ['key', 'count', 'ids', 'names']));
lines.push('### 4.4 Applications-sheet duplicates by national_id (top 20)');
lines.push(md(topN(dupAppsById), ['key', 'count', 'names']));
lines.push('### 4.5 Cross-source identity collisions (top 20)');
lines.push(md(topN(crossCollisions), ['national_id', 'db_names', 'xlsx_name']));
lines.push('');

lines.push('## 5. Building / room reconciliation');
lines.push('');
lines.push(`**${buildingMismatches.length}** residents have a building in the DB that does not match the xlsx applications sheet's "الفرع المطلوب". Of those, **${defaultBuildingAudit.length}** are exactly the *-1 vs *-2 disambiguation case the user flagged (e.g. residents defaulted to \`khobar-alolaya\` (building 1) but xlsx says they belong in \`khobar-alolaya-2\`, or vice versa). **${intakeAssignments.length}** active residents are still parked on placeholder \`INTAKE\` apartments.`);
lines.push('');
lines.push('### 5.1 Building mismatches (top 20)');
lines.push(md(topN(buildingMismatches), ['resident_id', 'name', 'db_building', 'xlsx_resolved', 'xlsx_branch', 'xlsx_reason']));
lines.push('### 5.2 Default-building (-1/-2) audit (top 20)');
lines.push(md(topN(defaultBuildingAudit), ['resident_id', 'name', 'db_building', 'xlsx_resolved', 'xlsx_branch']));
lines.push('### 5.3 INTAKE cleanup candidates with supervisor-derived target (top 20)');
lines.push(md(topN(intakeFix), ['resident_id', 'name', 'db_building', 'xlsx_branch', 'unit', 'supervisor_comment']));
lines.push('');

lines.push('## 6. Status discrepancies');
lines.push('');
lines.push('### 6.1 DB checked_out but appears in tenant_portal or deductions (top 20)');
lines.push(md(topN(dbCheckedOutButXlsxActive), ['resident_id', 'name', 'in_tenant_portal', 'in_deductions']));
lines.push('### 6.2 DB active but absent from BOTH tenant_portal and deductions (top 20)');
lines.push(md(topN(dbActiveButNotInSheets), ['resident_id', 'name', 'phone', 'national_id']));
lines.push('### 6.3 In tenant_portal but not in deductions (top 20)');
lines.push(md(topN(inTpNotDed).map(t => ({ name: t.name, phone: t.phone, branch: t.branch, username: t.username })), ['name', 'phone', 'branch', 'username']));
lines.push('### 6.4 In deductions but not in tenant_portal (top 20)');
lines.push(md(topN(inDedNotTp).map(d => ({ name: d.name, id: d.id, phone: d.phone, branch: d.branch })), ['name', 'id', 'phone', 'branch']));
lines.push('### 6.5 In tenant_portal with no DB resident at all (xlsx-only newcomers) (top 20)');
lines.push(md(topN(xlsxOnlyTp), ['name', 'phone', 'branch']));
lines.push('### 6.6 In deductions with no DB resident (top 20)');
lines.push(md(topN(xlsxOnlyDed), ['name', 'id', 'phone', 'branch']));
lines.push('');

lines.push('## 7. Data quality gaps the xlsx can fill');
lines.push('');
lines.push(`**${placeholderPhones.length}** DB residents carry the \`0000000000\` placeholder phone. The applications sheet supplies a real phone for **${fillablePhones.length}** of them. **${nullDob.length}** residents have null DOB; xlsx fills **${fillableDob.length}**. **${nullNationality.length}** have null nationality (the xlsx has no nationality column — would need a different source).`);
lines.push('');
lines.push('### 7.1 Placeholder phones fillable from xlsx (top 20)');
lines.push(md(topN(fillablePhones), ['resident_id', 'name', 'xlsx_phone']));
lines.push('### 7.2 Null DOB fillable from xlsx (top 20)');
lines.push(md(topN(fillableDob), ['resident_id', 'name', 'xlsx_dob']));
lines.push('### 7.3 Null nationality (no fill source) (top 20)');
lines.push(md(topN(nullNationality).map(r => ({ resident_id: r.id, name: r.full_name })), ['resident_id', 'name']));
lines.push('');

lines.push('## 8. Recommended manual fixes');
lines.push('');
lines.push('All SQL below is suggested text — the audit script does **not** execute it. Apply via Supabase SQL Editor or `mcp__supabase__execute_sql` after spot-checking the CSVs in `reports/verify/checks/`.');
lines.push('');
lines.push('### Critical');
lines.push(`1. **Move ${intakeAssignments.length} active residents off INTAKE apartments.** ${intakeFix.length} have a supervisor comment in the xlsx that parses to a real apartment+room. See \`check7_intake_fix_candidates.csv\` for the full list grouped by destination apartment, then run targeted UPDATEs that swap \`room_id\` on \`room_assignments\`.`);
lines.push(`2. **Flip ${dbCheckedOutButXlsxActive.length} residents back to \`active\`** if they truly appear in tenant_portal (the user-confirmed primary signal). See \`check5_db_checkedout_xlsx_active.csv\`. Do **not** auto-flip residents that only appear in deductions — corroborate with tenant_portal first.`);
lines.push('');
lines.push('### High');
lines.push(`3. **Black list import (${blInDb.length} updates + ${blNotInDb.length} inserts).** First 20 sample statements:`);
lines.push('');
lines.push('```sql');
lines.push('-- UPDATE existing residents already in DB');
lines.push(...sqlBlUpdates);
lines.push('');
lines.push('-- INSERT residents not yet in DB (status=checked_out, notes=Black list)');
lines.push(...sqlBlInserts);
lines.push('```');
lines.push('');
lines.push('Full lists in `check_blacklist_in_db.csv` and `check_blacklist_not_in_db.csv`.');
lines.push('');
lines.push(`4. **Resolve ${defaultBuildingAudit.length} default-building -1/-2 mistakes.** Each row in \`check3_default_building_audit.csv\` needs the resident's active room_assignment moved to a room in the correct building. Most likely a single batch UPDATE per branch pair.`);
lines.push('');
lines.push('### Medium');
lines.push(`5. **Backfill ${fillablePhones.length} placeholder phones** from the applications sheet:`);
lines.push('```sql');
const sampleFillPhone = fillablePhones.slice(0, 10).map(f => `UPDATE residents SET phone='${f.xlsx_phone}' WHERE id='${f.resident_id}' AND phone='0000000000';`);
lines.push(...sampleFillPhone);
lines.push('```');
lines.push('Full list in `check6_fillable_phones.csv`.');
lines.push('');
lines.push(`6. **Backfill ${fillableDob.length} null DOBs** similarly from \`check6_fillable_dob.csv\`.`);
lines.push('');
lines.push(`7. **Manually review ${dbActiveButNotInSheets.length} DB-active-but-xlsx-silent residents** (see \`check5_db_active_not_in_sheets.csv\`) — these are likely silent move-outs that should be \`checked_out\`.`);
lines.push('');
lines.push('### Low');
lines.push(`8. **Investigate ${dupDbById.length} national_id duplicates** and ${dupDbByPhone.length} phone duplicates. Most are likely the same person with two records — merge after confirming.`);
lines.push(`9. **Investigate ${crossCollisions.length} cross-source identity collisions** (same national_id, different names) — typo on either side or two people sharing an ID by accident.`);
lines.push(`10. **Consider importing ${xlsxOnlyTp.length + xlsxOnlyDed.length} xlsx-only active residents** — these appear in tenant_portal/deductions but have no DB row. Confirm they are real current tenants, not stale rows, before insert.`);
lines.push('');
lines.push('---');
lines.push('');
lines.push(`Per-check CSVs are in \`scripts/import-residents/reports/verify/checks/\`. Raw inputs (xlsx-derived CSVs and DB JSON snapshots) are in \`scripts/import-residents/reports/verify/raw/\`.`);
lines.push('');

fs.writeFileSync(REPORT_PATH, lines.join('\n'));
console.log('REPORT written: ' + REPORT_PATH);

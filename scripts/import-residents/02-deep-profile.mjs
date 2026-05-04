#!/usr/bin/env node
// Stage 2 — deep profile of high-stakes columns.
//
// Reads data/residents.csv and produces a focused report:
//   - Confirms row 1 is the legend row (not data)
//   - Lists all distinct building strings (col 15) so user can confirm name→UUID mapping
//   - Lists all distinct unit types (col 19)
//   - Estimates unique resident count grouped by national_id, phone, name
//   - Samples supervisor comments (col 13) and parses out apartment/room/type if possible
//   - Scans contract-end dates in Ejar notes (col 3)
//
// READ-ONLY.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CSV_PATH = path.join(ROOT, 'data', 'residents.csv');
const REPORT_PATH = path.join(__dirname, 'reports', '02-deep-profile.txt');

// Column indices (per stage-1 profile)
const COL = {
  TIMESTAMP: 0,
  HEALTH: 1,
  NOTES_INTERNAL: 2,
  EJAR_NOTES: 3,
  FULL_NAME: 4,
  DOB_1: 5,
  PHONE_OLD: 6,
  EMERGENCY_OLD: 7,
  CIVIL_REGISTER: 8,
  RATING: 9,
  NATIONAL_ID: 10,
  PHONE: 11,
  CONTRACT_START: 12,
  SUPERVISOR_COMMENT: 13,
  WORKPLACE: 14,
  BUILDING: 15,
  EMAIL_OR_DOB: 16,
  ORIGIN_CITY: 17,
  EMERGENCY_PHONE: 18,
  UNIT_TYPE: 19,
  PAYMENT_METHOD: 20,
  WITH_TRANSPORT: 21,
  TRANSPORT_DURATION: 22,
  IBAN: 23,
  BANK_HOLDER: 24,
  HEARD_FROM: 25,
  REGION: 26,
};

function normPhone(s) {
  if (!s) return '';
  const digits = s.replace(/[^\d]/g, '');
  // strip leading country code 966 → 0
  if (digits.startsWith('966') && digits.length === 12) return '0' + digits.slice(3);
  if (digits.startsWith('00966') && digits.length === 14) return '0' + digits.slice(5);
  // already starts with 0 → keep
  if (digits.startsWith('0') && digits.length === 10) return digits;
  // 9 digits → assume missing leading 0
  if (digits.length === 9) return '0' + digits;
  return digits;
}

function isLegendRow(row) {
  // The first data row contains Google Forms category tags rather than real values.
  // Heuristic: full_name field contains a known tag string.
  const name = (row[COL.FULL_NAME] || '').trim();
  return name === 'تأكيد الدفع +كشف المستجدات' || name.includes('تأكيد الدفع');
}

function tryParseDate(s) {
  if (!s) return null;
  s = s.trim();
  // YYYY/MM/DD or YYYY-MM-DD
  let m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const [_, y, mo, d] = m;
    const date = new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!isNaN(date)) return date.toISOString().slice(0, 10);
  }
  // DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [_, d, mo, y] = m;
    const date = new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!isNaN(date)) return date.toISOString().slice(0, 10);
  }
  return null;
}

// Try to extract apartment number, room number, and unit-type from the
// supervisor's free-text comment column. Examples seen in data:
//   "الدخول تاريخ 14 فبراير 2026 - شقه 27 غرفه 3 -  ثنائي مشترك"
//   "الدخول بتاريخ ديسمبر 2024, شقه 506, غرفه 2 , ثنائي مشترك"
//   "الدخول بتاريخ 13 ديسمبر 2025 - شقة 103 غرفة 2 (ثنائي ماستر)"
//   "الدخول بتاريخ 7 إبريل 2026 - شقة B6 غرفة 1 ( ثنائي خاص )"
function parseSupervisorComment(s) {
  if (!s) return null;
  // Apartment: شقه|شقة, then number (may include letters like B6)
  const aptM = s.match(/شق[هة]\s*([A-Z0-9٠-٩]+)/i);
  const roomM = s.match(/غرف[هة]\s*([0-9٠-٩]+)/);
  const apt = aptM ? aptM[1] : null;
  const room = roomM ? roomM[1] : null;
  return { apartment: apt, room, raw: s };
}

function topN(counts, n = 20) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function main() {
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(text);
  const header = rows[0];
  let dataRows = rows.slice(1);

  const lines = [];
  const log = (s = '') => lines.push(s);

  log('='.repeat(80));
  log('SAKAN ALSAYD — DEEP PROFILE OF HIGH-STAKES COLUMNS');
  log(`Generated: ${new Date().toISOString()}`);
  log('='.repeat(80));
  log();

  // 1. Confirm legend row
  const firstIsLegend = isLegendRow(dataRows[0]);
  log(`Row 1 looks like Google Forms legend (skip it): ${firstIsLegend ? 'YES' : 'no'}`);
  if (firstIsLegend) {
    log(`  full_name on row 1: ${JSON.stringify(dataRows[0][COL.FULL_NAME])}`);
    dataRows = dataRows.slice(1);
  }
  log(`Data rows after legend skip: ${dataRows.length.toLocaleString()}`);
  log();

  // 2. Building strings — exhaustive list
  log('='.repeat(80));
  log('BUILDING STRINGS (col 15) — every distinct value');
  log('='.repeat(80));
  const buildingCounts = {};
  for (const r of dataRows) {
    const v = (r[COL.BUILDING] || '').trim();
    if (!v) continue;
    buildingCounts[v] = (buildingCounts[v] || 0) + 1;
  }
  const buildingsSorted = Object.entries(buildingCounts).sort((a, b) => b[1] - a[1]);
  log(`Distinct: ${buildingsSorted.length}`);
  for (const [val, count] of buildingsSorted) {
    log(`  ${count.toString().padStart(5)}× ${JSON.stringify(val)}`);
  }
  log();

  // 3. Unit types (col 19)
  log('='.repeat(80));
  log('UNIT TYPES (col 19) — every distinct value');
  log('='.repeat(80));
  const unitCounts = {};
  for (const r of dataRows) {
    const v = (r[COL.UNIT_TYPE] || '').trim();
    if (!v) continue;
    unitCounts[v] = (unitCounts[v] || 0) + 1;
  }
  const unitsSorted = Object.entries(unitCounts).sort((a, b) => b[1] - a[1]);
  log(`Distinct: ${unitsSorted.length}`);
  for (const [val, count] of unitsSorted) {
    const display = val.length > 100 ? val.slice(0, 97) + '...' : val;
    log(`  ${count.toString().padStart(5)}× ${JSON.stringify(display)}`);
  }
  log();

  // 4. Dedup grouping
  log('='.repeat(80));
  log('UNIQUE RESIDENT ESTIMATION (grouping by national_id, phone, name)');
  log('='.repeat(80));
  const byId = new Map();    // national_id → row count
  const byPhone = new Map(); // normalized phone → row count
  const byName = new Map();  // full_name → row count
  const byIdPhone = new Map(); // (id||phone) composite key → row count
  let missingId = 0, missingPhone = 0, missingName = 0;

  for (const r of dataRows) {
    const id = (r[COL.NATIONAL_ID] || '').trim();
    const phone = normPhone(r[COL.PHONE] || '');
    const name = (r[COL.FULL_NAME] || '').trim();
    if (!id) missingId++;
    if (!phone) missingPhone++;
    if (!name) missingName++;
    if (id) byId.set(id, (byId.get(id) || 0) + 1);
    if (phone) byPhone.set(phone, (byPhone.get(phone) || 0) + 1);
    if (name) byName.set(name, (byName.get(name) || 0) + 1);
    const k = id || phone;
    if (k) byIdPhone.set(k, (byIdPhone.get(k) || 0) + 1);
  }

  log(`Distinct national_id (col 10):       ${byId.size.toLocaleString()}`);
  log(`Distinct phone (col 11, normalized): ${byPhone.size.toLocaleString()}`);
  log(`Distinct full_name (col 4):          ${byName.size.toLocaleString()}`);
  log(`Distinct (national_id || phone):     ${byIdPhone.size.toLocaleString()}  ← best estimate of unique residents`);
  log();
  log(`Rows missing national_id: ${missingId.toLocaleString()}`);
  log(`Rows missing phone:       ${missingPhone.toLocaleString()}`);
  log(`Rows missing full_name:   ${missingName.toLocaleString()}`);
  log();

  // Top 10 most-repeated IDs (multiple stays per person)
  const repeatIds = [...byId.entries()].filter(([_, c]) => c > 1).sort((a, b) => b[1] - a[1]);
  log(`Residents (by national_id) with >1 row: ${repeatIds.length.toLocaleString()}`);
  log(`Top repeat IDs (potential renewals):`);
  for (const [id, c] of repeatIds.slice(0, 15)) {
    log(`  ${c}× id=${id}`);
  }
  log();

  // 5. Supervisor comment parsing — sample
  log('='.repeat(80));
  log('SUPERVISOR COMMENTS (col 13) — apartment/room extraction');
  log('='.repeat(80));
  let withComment = 0, parsedApt = 0, parsedRoom = 0, parsedBoth = 0;
  const samples = [];
  for (const r of dataRows) {
    const c = (r[COL.SUPERVISOR_COMMENT] || '').trim();
    if (!c) continue;
    withComment++;
    const parsed = parseSupervisorComment(c);
    if (parsed.apartment) parsedApt++;
    if (parsed.room) parsedRoom++;
    if (parsed.apartment && parsed.room) parsedBoth++;
    if (samples.length < 25) {
      samples.push({ raw: c, parsed });
    }
  }
  log(`Rows with supervisor comment:                 ${withComment.toLocaleString()}`);
  log(`Comments with parseable apartment number:    ${parsedApt.toLocaleString()} (${(parsedApt / withComment * 100).toFixed(1)}%)`);
  log(`Comments with parseable room number:         ${parsedRoom.toLocaleString()} (${(parsedRoom / withComment * 100).toFixed(1)}%)`);
  log(`Comments with both apartment AND room:       ${parsedBoth.toLocaleString()} (${(parsedBoth / withComment * 100).toFixed(1)}%)`);
  log();
  log('Sample parsed comments:');
  for (const s of samples) {
    log(`  raw:    ${JSON.stringify(s.raw)}`);
    log(`  apt=${s.parsed.apartment || '—'}  room=${s.parsed.room || '—'}`);
    log();
  }

  // 6. Contract start date format check
  log('='.repeat(80));
  log('CONTRACT START DATE (col 12) — parseability');
  log('='.repeat(80));
  let totalContractStart = 0, parsedContractStart = 0;
  const unparseSamples = [];
  for (const r of dataRows) {
    const v = (r[COL.CONTRACT_START] || '').trim();
    if (!v) continue;
    totalContractStart++;
    const parsed = tryParseDate(v);
    if (parsed) parsedContractStart++;
    else if (unparseSamples.length < 20) unparseSamples.push(v);
  }
  log(`Rows with contract_start:        ${totalContractStart.toLocaleString()}`);
  log(`Parseable as YYYY-MM-DD:         ${parsedContractStart.toLocaleString()} (${(parsedContractStart / totalContractStart * 100).toFixed(1)}%)`);
  log(`Unparseable samples:`);
  for (const v of unparseSamples) {
    log(`  ${JSON.stringify(v)}`);
  }
  log();

  // 7. Ejar notes — contract end dates
  log('='.repeat(80));
  log('EJAR NOTES (col 3) — contract-end signal');
  log('='.repeat(80));
  let withEjar = 0, withEndDate = 0, withMukarrar = 0, withTalaat = 0;
  const endDateRe = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/;
  for (const r of dataRows) {
    const c = (r[COL.EJAR_NOTES] || '').trim();
    if (!c) continue;
    withEjar++;
    if (endDateRe.test(c)) withEndDate++;
    if (c.includes('مكرر')) withMukarrar++;     // "duplicate"
    if (c.includes('طلعت') || c.includes('طلع')) withTalaat++; // "left/checked-out"
  }
  log(`Rows with Ejar notes:        ${withEjar.toLocaleString()}`);
  log(`Containing a date pattern:   ${withEndDate.toLocaleString()}`);
  log(`Containing 'مكرر' (duplicate): ${withMukarrar.toLocaleString()}`);
  log(`Containing 'طلعت/طلع' (left): ${withTalaat.toLocaleString()}`);
  log();

  // 8. Email column (col 16) repurposing
  log('='.repeat(80));
  log('COLUMN 16 — DOB header but mostly emails');
  log('='.repeat(80));
  let emails = 0, dates = 0, neither = 0;
  for (const r of dataRows) {
    const v = (r[COL.EMAIL_OR_DOB] || '').trim();
    if (!v) continue;
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) emails++;
    else if (tryParseDate(v)) dates++;
    else neither++;
  }
  log(`Email-shaped: ${emails.toLocaleString()}`);
  log(`Date-shaped:  ${dates.toLocaleString()}`);
  log(`Neither:      ${neither.toLocaleString()}`);
  log();

  // 9. Region (col 26) — for nationality maybe? actually "tenant region"
  log('='.repeat(80));
  log('REGION (col 26)');
  log('='.repeat(80));
  const regionCounts = {};
  for (const r of dataRows) {
    const v = (r[COL.REGION] || '').trim();
    if (!v) continue;
    regionCounts[v] = (regionCounts[v] || 0) + 1;
  }
  for (const [val, count] of Object.entries(regionCounts).sort((a, b) => b[1] - a[1])) {
    log(`  ${count.toString().padStart(5)}× ${JSON.stringify(val)}`);
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Deep profile written to ${path.relative(ROOT, REPORT_PATH)}`);
}

main();

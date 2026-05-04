#!/usr/bin/env node
// Stage 3 — transform CSV rows into the structures we'll insert.
//
// READ-ONLY (no DB connection). Outputs three files:
//   reports/03-transformed.json   — { residents: [...], stats: {...} }
//   reports/03-skipped.csv        — rows we couldn't use, with reason
//   reports/03-summary.txt        — human-readable counts/breakdowns
//
// Pipeline per CSV row (after legend skip):
//   1. Validate that name + (national_id or phone) exist; else skip row
//   2. Normalise phone, email, national_id
//   3. Map building string  (lib/building-mapping.mjs)
//   4. Parse contract_start date (col 12)
//   5. Parse Ejar end-date (col 3) → status signal
//   6. Parse supervisor comment (col 13) → apartment/room/check-in date
//   7. Map unit type (col 19) → room_type/bathroom/capacity/mode
//   8. Build a "stay" record
//
// Then group all stays by national_id (or phone fallback), keep most-recent
// per resident as the "current" record, treat older stays as history.
// Status: active iff most-recent stay's Ejar end-date >= today.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';
import { mapBuilding } from './lib/building-mapping.mjs';
import { mapUnitType } from './lib/unit-type-mapping.mjs';
import { parseSupervisorComment } from './lib/supervisor-comment.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CSV_PATH = path.join(ROOT, 'data', 'residents.csv');
const OUT_JSON = path.join(__dirname, 'reports', '03-transformed.json');
const OUT_SKIPPED = path.join(__dirname, 'reports', '03-skipped.csv');
const OUT_SUMMARY = path.join(__dirname, 'reports', '03-summary.txt');

const TODAY = '2026-05-04'; // freeze for reproducibility — see CLAUDE.md currentDate

// Status rule G (per user decision 2026-05-04):
//   active iff (Ejar end-date >= today) OR (most-recent contract_start within
//   the last 18 months). Residents flipped to 'checked_out' otherwise. The
//   18-month window is wide enough to catch long-stay residents but narrow
//   enough to exclude clearly-departed ones.
const ACTIVE_CONTRACT_CUTOFF = (() => {
  const d = new Date(TODAY + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - 18);
  return d.toISOString().slice(0, 10);
})();

// CSV column indices (verified by stage 1/2 profiles)
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

function isLegendRow(row) {
  const name = (row[COL.FULL_NAME] || '').trim();
  return name === 'تأكيد الدفع +كشف المستجدات' || name.includes('تأكيد الدفع');
}

function trim(s) {
  return (s || '').trim();
}

function normalizePhone(s) {
  s = trim(s);
  if (!s) return null;
  const digits = s.replace(/[^\d]/g, '');
  if (!digits) return null;
  // strip Saudi country code variants → 0XXXXXXXXX (10 digits)
  if (digits.startsWith('00966') && digits.length >= 14) return '0' + digits.slice(5).slice(0, 9);
  if (digits.startsWith('966') && digits.length === 12) return '0' + digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) return digits;
  // 9 digits with no leading 0 → assume Saudi mobile, prepend 0
  if (digits.length === 9) return '0' + digits;
  // anything else, return as-is for the validator to flag
  return digits;
}

function isValidSaudiMobile(p) {
  return /^05\d{8}$/.test(p);
}

function normalizeEmail(s) {
  s = trim(s).toLowerCase();
  if (!s) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return null;
  return s;
}

function normalizeNationalId(s) {
  s = trim(s);
  if (!s) return null;
  // strip whitespace, keep digits-only if it's already numeric
  const cleaned = s.replace(/\s+/g, '');
  // Saudi IDs/Iqamas are 10 digits
  if (/^\d{10}$/.test(cleaned)) return cleaned;
  return cleaned; // keep as-is for validator
}

// Convert Hijri (Islamic) date to Gregorian. The data uses two-letter
// Hijri-year formats like "21/1/1443" or "٢١/١/١٤٤٣". A precise conversion
// requires the lunar calendar, but a linear approximation is good enough for
// classifying "is this contract_start within the last N months". The
// conversion error is ±1–2 days, well below our month-grain decisions.
function hijriToGregorian(hYear, hMonth, hDay) {
  // The Islamic calendar is ~10.875 days shorter per year than Gregorian.
  // Reference anchor: 1 Muharram 1443 AH = 9 August 2021 CE.
  const REF_HIJRI_YEAR = 1443;
  const REF_GREG_DATE = new Date(Date.UTC(2021, 7, 9)); // 2021-08-09
  const HIJRI_YEAR_DAYS = 354.367;
  const HIJRI_MONTH_DAYS = 29.5305;
  const yearDiff = hYear - REF_HIJRI_YEAR;
  const days = yearDiff * HIJRI_YEAR_DAYS + (hMonth - 1) * HIJRI_MONTH_DAYS + (hDay - 1);
  const ms = REF_GREG_DATE.getTime() + days * 86400 * 1000;
  const d = new Date(ms);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}

function tryParseDate(s) {
  s = trim(s);
  if (!s) return null;

  // Convert Arabic-Indic digits → ASCII
  s = s.replace(/[٠-٩]/g, (d) => '0123456789'[d.charCodeAt(0) - 0x0660]);

  // Strip stray spaces/text around the date
  // e.g. "21 / 1 / 1443" → "21/1/1443"
  s = s.replace(/\s*\/\s*/g, '/').replace(/\s*-\s*/g, '-');

  // Hijri-year detection: trailing or middle 4-digit number 1400–1500
  // Patterns: "21/1/1443", "1443/1/21", "21 محرم 1443" (handled separately below)
  let mh = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](14\d{2})$/);
  if (mh) {
    const d = +mh[1], mo = +mh[2], y = +mh[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 30) {
      return hijriToGregorian(y, mo, d);
    }
  }
  mh = s.match(/^(14\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (mh) {
    const y = +mh[1], mo = +mh[2], d = +mh[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 30) {
      return hijriToGregorian(y, mo, d);
    }
  }

  // Excel serial number (e.g. 44387 = 2021-08-25)
  if (/^\d{4,6}$/.test(s)) {
    const n = +s;
    if (n >= 30000 && n <= 60000) {
      // Excel epoch (1900-01-01 day 1, but with the famous 1900 leap-year bug)
      const ms = (n - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d)) return d.toISOString().slice(0, 10);
    }
  }

  // YYYY/MM/DD or YYYY-MM-DD
  let m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const d = +m[1], mo = +m[2], y = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2015 && y <= 2030) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // "YYYY/MM/DD" with extra whitespace
  m = s.match(/^\s*(\d{4})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*$/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

function extractEjarEndDate(ejarNotes) {
  if (!ejarNotes) return null;
  // Look for any date pattern; we only care about the latest one.
  const matches = [];
  const re = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})|(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g;
  let m;
  while ((m = re.exec(ejarNotes)) !== null) {
    let y, mo, d;
    if (m[4]) { // YYYY/MM/DD
      y = +m[4]; mo = +m[5]; d = +m[6];
    } else {    // DD/MM/YYYY
      d = +m[1]; mo = +m[2]; y = +m[3];
      if (y < 100) y += 2000; // 2-digit year heuristic
    }
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2015 && y <= 2030) {
      matches.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  if (!matches.length) return null;
  // Take the latest date (most likely the "ends on" date)
  matches.sort();
  return matches[matches.length - 1];
}

function buildResidentNotes({ csvRow, csvRowIndex, mostRecentStay, allStays, buildingDecision }) {
  const lines = [];
  lines.push(`[Imported 2026-05-04 from Google Forms CSV — row ${csvRowIndex + 1}]`);

  // Building hint when ambiguous/skipped
  if (mostRecentStay && !mostRecentStay.building_id && mostRecentStay.building_label) {
    lines.push(`فرع غير محدد بدقة (يحتاج مراجعة): ${mostRecentStay.building_label}`);
    if (buildingDecision?.reason) {
      lines.push(`سبب التخطي: ${buildingDecision.reason}`);
    }
  }

  // Most recent supervisor comment if any
  if (mostRecentStay?.supervisor_comment) {
    lines.push(`تعليق المشرفة: ${mostRecentStay.supervisor_comment}`);
  }

  // Workplace if present (we don't have a column for it on resident — the
  // university_or_workplace field is set separately. Keep notes for things
  // that don't have a column.)

  // Ejar notes (preserves contract end-dates)
  const ejar = trim(csvRow[COL.EJAR_NOTES]);
  if (ejar) lines.push(`ملاحظات إيجار: ${ejar}`);

  // Internal notes
  const internalNotes = trim(csvRow[COL.NOTES_INTERNAL]);
  if (internalNotes) lines.push(`ملاحظات داخلية: ${internalNotes}`);

  // Health note (only if substantive — most are "لا")
  const health = trim(csvRow[COL.HEALTH]);
  if (health && !['لا', 'No', 'no', 'لا يوجد', 'لايوجد', 'لا الحمدلله'].includes(health)) {
    lines.push(`ملاحظة صحية: ${health}`);
  }

  // Rating
  const rating = trim(csvRow[COL.RATING]);
  if (rating && /^[1-5]$/.test(rating)) lines.push(`تقييم سابق: ${rating}/5`);

  // Region / origin city
  const region = trim(csvRow[COL.REGION]);
  const city = trim(csvRow[COL.ORIGIN_CITY]);
  if (region) lines.push(`المنطقة: ${region}`);
  if (city) lines.push(`من مدينة: ${city}`);

  // Stays count
  if (allStays.length > 1) {
    lines.push(`عدد العقود/الطلبات في السجل: ${allStays.length}`);
  }

  return lines.join('\n').slice(0, 4900); // schema cap is 5000
}

function main() {
  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(csvText);
  const dataRows = rows.slice(1); // drop the header row

  const stats = {
    csv_total_rows: rows.length,
    data_rows: dataRows.length,
    legend_rows_skipped: 0,
    rows_skipped_no_name: 0,
    rows_skipped_no_id_or_phone: 0,
    rows_skipped_invalid_phone: 0,
    rows_with_email: 0,
    rows_with_valid_phone: 0,
    rows_with_invalid_phone: 0,
    rows_with_dob: 0,
    rows_with_ejar_endate_active: 0,
    rows_with_ejar_endate_ended: 0,
    rows_with_no_ejar_endate: 0,
    rows_with_supervisor_comment: 0,
    rows_with_parseable_apt_room: 0,
    rows_with_assignment_eligible: 0, // apt+room+non-ambiguous building
    building_breakdown: {},          // building_id → count
    building_skipped_reasons: {},     // reason → count
    unit_type_unmapped: [],
  };

  const skippedRows = []; // { csv_row, reason }
  const stays = [];       // each stay (= each non-skipped CSV row)

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const csvRowIndex = i + 1; // 1-based, matches profile reports

    // Skip legend row
    if (isLegendRow(r)) {
      stats.legend_rows_skipped++;
      continue;
    }

    const fullName = trim(r[COL.FULL_NAME]);
    if (!fullName) {
      stats.rows_skipped_no_name++;
      skippedRows.push({ csv_row: r, reason: 'no_name', index: csvRowIndex });
      continue;
    }

    const nationalId = normalizeNationalId(r[COL.NATIONAL_ID]);
    let phone = normalizePhone(r[COL.PHONE]);
    if (!phone) phone = normalizePhone(r[COL.PHONE_OLD]);
    const phoneIsValid = phone && isValidSaudiMobile(phone);

    if (!nationalId && !phone) {
      stats.rows_skipped_no_id_or_phone++;
      skippedRows.push({ csv_row: r, reason: 'no_id_or_phone', index: csvRowIndex });
      continue;
    }

    if (phone && !phoneIsValid) {
      stats.rows_with_invalid_phone++;
    } else if (phone) {
      stats.rows_with_valid_phone++;
    }

    const email = normalizeEmail(r[COL.EMAIL_OR_DOB]);
    if (email) stats.rows_with_email++;

    // DOB — col 5 is the trustworthy one
    const dob = tryParseDate(r[COL.DOB_1]);
    if (dob) stats.rows_with_dob++;

    // emergency phone
    let emergencyPhone = normalizePhone(r[COL.EMERGENCY_PHONE]);
    if (!emergencyPhone) emergencyPhone = normalizePhone(r[COL.EMERGENCY_OLD]);
    // sanity check: don't store strings like "لا يوجد" as phone
    if (emergencyPhone && !isValidSaudiMobile(emergencyPhone) && emergencyPhone.length < 9) {
      emergencyPhone = null;
    }

    const workplace = trim(r[COL.WORKPLACE]) || null;

    // Building
    const buildingDecision = mapBuilding(r[COL.BUILDING]);
    const buildingId = buildingDecision.buildingId;
    if (buildingId) {
      stats.building_breakdown[buildingId] = (stats.building_breakdown[buildingId] || 0) + 1;
    } else {
      stats.building_skipped_reasons[buildingDecision.reason] =
        (stats.building_skipped_reasons[buildingDecision.reason] || 0) + 1;
    }

    // Contract start date
    const contractStart = tryParseDate(r[COL.CONTRACT_START]);

    // Ejar end date
    const ejarEnd = extractEjarEndDate(r[COL.EJAR_NOTES]);
    if (ejarEnd) {
      if (ejarEnd >= TODAY) stats.rows_with_ejar_endate_active++;
      else stats.rows_with_ejar_endate_ended++;
    } else {
      stats.rows_with_no_ejar_endate++;
    }

    // Supervisor comment
    const supComment = trim(r[COL.SUPERVISOR_COMMENT]);
    let parsedComment = null;
    if (supComment) {
      stats.rows_with_supervisor_comment++;
      parsedComment = parseSupervisorComment(supComment);
      if (parsedComment?.apartment && parsedComment?.room) {
        stats.rows_with_parseable_apt_room++;
        if (buildingId) {
          stats.rows_with_assignment_eligible++;
        }
      }
    }

    // Unit type
    const unitTypeStr = trim(r[COL.UNIT_TYPE]);
    const unitSpec = unitTypeStr ? mapUnitType(unitTypeStr) : null;
    if (unitTypeStr && unitSpec && unitSpec.confidence === 'low') {
      if (!stats.unit_type_unmapped.includes(unitTypeStr)) {
        stats.unit_type_unmapped.push(unitTypeStr);
      }
    }

    stays.push({
      csv_row_index: csvRowIndex,
      full_name: fullName,
      national_id: nationalId,
      phone: phoneIsValid ? phone : null,
      phone_raw: phone,
      phone_invalid: phone && !phoneIsValid,
      email,
      dob,
      emergency_phone: emergencyPhone && isValidSaudiMobile(emergencyPhone) ? emergencyPhone : null,
      workplace,
      timestamp: trim(r[COL.TIMESTAMP]),
      contract_start: contractStart,
      ejar_end: ejarEnd,
      ejar_end_active: ejarEnd ? ejarEnd >= TODAY : false,
      supervisor_comment: supComment || null,
      parsed_apartment: parsedComment?.apartment || null,
      parsed_room: parsedComment?.room || null,
      parsed_check_in: parsedComment?.checkInDate || null,
      unit_type_str: unitTypeStr || null,
      unit_spec: unitSpec,
      building_id: buildingId,
      building_label: buildingDecision.original,
      building_decision_reason: buildingDecision.reason,
      // raw row preserved for notes composition
      _raw: r,
    });
  }

  // Group by national_id → fall back to phone for the few rows missing id
  const byKey = new Map();
  for (const s of stays) {
    const key = s.national_id || `phone:${s.phone}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(s);
  }

  const residents = [];
  for (const [key, group] of byKey) {
    // sort by timestamp asc; if no timestamp, by contract_start
    group.sort((a, b) => {
      const ta = a.timestamp || a.contract_start || '';
      const tb = b.timestamp || b.contract_start || '';
      return ta.localeCompare(tb);
    });
    const mostRecent = group[group.length - 1];

    // Resident-level status — rule G:
    //   active iff (Ejar end-date >= today) OR (most-recent contract_start
    //   is within the last 18 months).
    const ejarFuture = mostRecent.ejar_end_active;
    const contractRecent = mostRecent.contract_start
      ? mostRecent.contract_start >= ACTIVE_CONTRACT_CUTOFF
      : false;
    const status = (ejarFuture || contractRecent) ? 'active' : 'checked_out';

    const notes = buildResidentNotes({
      csvRow: mostRecent._raw,
      csvRowIndex: mostRecent.csv_row_index,
      mostRecentStay: mostRecent,
      allStays: group,
      buildingDecision: { reason: mostRecent.building_decision_reason },
    });

    residents.push({
      key, // dedup key (national_id or phone)
      full_name: mostRecent.full_name,
      phone: mostRecent.phone || mostRecent.phone_raw || null,
      phone_was_invalid: mostRecent.phone_invalid || false,
      email: mostRecent.email,
      national_id_or_iqama: mostRecent.national_id,
      date_of_birth: mostRecent.dob,
      university_or_workplace: mostRecent.workplace,
      emergency_contact_phone: mostRecent.emergency_phone,
      emergency_contact_name: null,
      profile_image: null,
      nationality: null,
      documents: [],
      status,
      notes,
      stays: group.map((s, idx) => ({
        is_most_recent: idx === group.length - 1,
        csv_row_index: s.csv_row_index,
        timestamp: s.timestamp,
        contract_start: s.contract_start,
        ejar_end: s.ejar_end,
        building_id: s.building_id,
        building_label: s.building_label,
        building_decision_reason: s.building_decision_reason,
        apartment: s.parsed_apartment,
        room: s.parsed_room,
        parsed_check_in: s.parsed_check_in,
        unit_type_str: s.unit_type_str,
        unit_spec: s.unit_spec,
        supervisor_comment: s.supervisor_comment,
      })),
    });
  }

  stats.unique_residents = residents.length;
  stats.stays_total = stays.length;
  stats.residents_active = residents.filter((r) => r.status === 'active').length;
  stats.residents_checked_out = residents.filter((r) => r.status === 'checked_out').length;

  // Count assignment-eligible stays after dedup (not just per-row)
  let eligibleAssignments = 0;
  for (const r of residents) {
    for (const s of r.stays) {
      if (s.apartment && s.room && s.building_id) eligibleAssignments++;
    }
  }
  stats.eligible_room_assignments = eligibleAssignments;

  // Write outputs
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generated_at: new Date().toISOString(),
    source_csv: path.relative(ROOT, CSV_PATH),
    today: TODAY,
    stats,
    residents,
  }, null, 2), 'utf8');

  // Skipped CSV
  const skippedHeader = ['csv_row_index', 'reason', 'full_name', 'national_id', 'phone'];
  const skippedLines = [skippedHeader.join(',')];
  for (const sk of skippedRows) {
    const r = sk.csv_row;
    skippedLines.push([
      sk.index,
      sk.reason,
      JSON.stringify(trim(r[COL.FULL_NAME])),
      JSON.stringify(trim(r[COL.NATIONAL_ID])),
      JSON.stringify(trim(r[COL.PHONE])),
    ].join(','));
  }
  fs.writeFileSync(OUT_SKIPPED, skippedLines.join('\n') + '\n', 'utf8');

  // Summary
  const summary = [];
  summary.push('='.repeat(80));
  summary.push('SAKAN ALSAYD — CSV TRANSFORM SUMMARY');
  summary.push(`Generated: ${new Date().toISOString()}`);
  summary.push(`Today (status threshold): ${TODAY}`);
  summary.push('='.repeat(80));
  summary.push('');
  summary.push('INPUT');
  summary.push(`  CSV total rows (incl header):     ${stats.csv_total_rows.toLocaleString()}`);
  summary.push(`  Data rows:                        ${stats.data_rows.toLocaleString()}`);
  summary.push(`  Legend rows skipped:              ${stats.legend_rows_skipped.toLocaleString()}`);
  summary.push('');
  summary.push('SKIPPED ROWS (excluded from import)');
  summary.push(`  Missing name:                     ${stats.rows_skipped_no_name.toLocaleString()}`);
  summary.push(`  Missing both id and phone:        ${stats.rows_skipped_no_id_or_phone.toLocaleString()}`);
  summary.push(`  → see reports/03-skipped.csv`);
  summary.push('');
  summary.push('USABLE STAYS (one per non-skipped CSV row)');
  summary.push(`  Total stays:                      ${stats.stays_total.toLocaleString()}`);
  summary.push(`  With valid Saudi phone:           ${stats.rows_with_valid_phone.toLocaleString()}`);
  summary.push(`  With invalid phone (kept anyway): ${stats.rows_with_invalid_phone.toLocaleString()}`);
  summary.push(`  With email:                       ${stats.rows_with_email.toLocaleString()}`);
  summary.push(`  With date of birth:               ${stats.rows_with_dob.toLocaleString()}`);
  summary.push(`  With supervisor comment:          ${stats.rows_with_supervisor_comment.toLocaleString()}`);
  summary.push(`  With parseable apt+room:          ${stats.rows_with_parseable_apt_room.toLocaleString()}`);
  summary.push(`  ↳ AND non-ambiguous building:    ${stats.rows_with_assignment_eligible.toLocaleString()}  ← eligible for room_assignment`);
  summary.push('');
  summary.push('STATUS INFERENCE (Ejar notes end-date rule)');
  summary.push(`  Stays with Ejar end >= today:     ${stats.rows_with_ejar_endate_active.toLocaleString()}`);
  summary.push(`  Stays with Ejar end < today:      ${stats.rows_with_ejar_endate_ended.toLocaleString()}`);
  summary.push(`  Stays with no Ejar end signal:    ${stats.rows_with_no_ejar_endate.toLocaleString()}`);
  summary.push('');
  summary.push('UNIQUE RESIDENTS (after dedup by national_id || phone)');
  summary.push(`  Total residents:                  ${stats.unique_residents.toLocaleString()}`);
  summary.push(`  Active:                           ${stats.residents_active.toLocaleString()}`);
  summary.push(`  Checked-out:                      ${stats.residents_checked_out.toLocaleString()}`);
  summary.push(`  Eligible room_assignments:        ${stats.eligible_room_assignments.toLocaleString()}`);
  summary.push('');
  summary.push('BUILDING BREAKDOWN (stays per building)');
  for (const [bid, count] of Object.entries(stats.building_breakdown).sort((a, b) => b[1] - a[1])) {
    summary.push(`  ${bid}: ${count.toLocaleString()}`);
  }
  summary.push('');
  summary.push('UNRESOLVED BUILDING REASONS');
  for (const [reason, count] of Object.entries(stats.building_skipped_reasons).sort((a, b) => b[1] - a[1])) {
    summary.push(`  ${reason}: ${count.toLocaleString()}`);
  }
  summary.push('');
  if (stats.unit_type_unmapped.length) {
    summary.push('LOW-CONFIDENCE UNIT-TYPE STRINGS (managers should verify)');
    for (const u of stats.unit_type_unmapped) summary.push(`  ${JSON.stringify(u)}`);
    summary.push('');
  }
  fs.writeFileSync(OUT_SUMMARY, summary.join('\n') + '\n', 'utf8');

  console.log('Transform complete:');
  console.log(`  ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`  ${path.relative(ROOT, OUT_SKIPPED)}`);
  console.log(`  ${path.relative(ROOT, OUT_SUMMARY)}`);
  console.log('');
  console.log(`Unique residents:           ${stats.unique_residents.toLocaleString()}`);
  console.log(`  active:                   ${stats.residents_active.toLocaleString()}`);
  console.log(`  checked_out:              ${stats.residents_checked_out.toLocaleString()}`);
  console.log(`Eligible room_assignments:  ${stats.eligible_room_assignments.toLocaleString()}`);
  console.log(`Skipped rows:               ${skippedRows.length.toLocaleString()}`);
}

main();

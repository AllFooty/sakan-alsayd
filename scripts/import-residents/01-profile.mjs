#!/usr/bin/env node
// Stage 1 — profile the residents CSV without modifying anything.
//
// Reads data/residents.csv, parses it with our RFC 4180 parser, and writes
// a human-readable profile report to scripts/import-residents/reports/01-profile.txt.
//
// Goals:
//   - Confirm row-count and data start line (the file has multi-line quoted headers)
//   - List every column with: non-null %, distinct count, top 5 values, length range
//   - Flag obvious data quality issues per column (numeric, date, phone, email)
//
// READ-ONLY — never connects to Supabase.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib/csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CSV_PATH = path.join(ROOT, 'data', 'residents.csv');
const REPORT_PATH = path.join(__dirname, 'reports', '01-profile.txt');

function pct(num, den) {
  if (den === 0) return '0.0%';
  return ((num / den) * 100).toFixed(1) + '%';
}

function topN(counts, n = 5) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function classify(values) {
  // Returns: { numeric, date, phoneish, emailish, multiline }
  let numeric = 0;
  let date = 0;
  let phoneish = 0;
  let emailish = 0;
  let multiline = 0;
  const dateRe = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$|^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/;
  const phoneRe = /^\+?[0-9\s\-()]{6,20}$/;
  const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  for (const v of values) {
    if (!v) continue;
    if (/^-?\d+(\.\d+)?$/.test(v)) numeric++;
    if (dateRe.test(v)) date++;
    if (phoneRe.test(v)) phoneish++;
    if (emailRe.test(v)) emailish++;
    if (v.includes('\n')) multiline++;
  }
  return { numeric, date, phoneish, emailish, multiline };
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERROR: ${CSV_PATH} not found`);
    process.exit(1);
  }

  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(text);

  if (rows.length === 0) {
    console.error('Empty CSV');
    process.exit(1);
  }

  // The CSV starts with one or more "header-like" rows. The first row is the
  // canonical column list (Google Forms exports use exactly one header row,
  // even if column NAMES contain newlines — the parser handles that).
  const header = rows[0];
  const dataRows = rows.slice(1);
  const colCount = header.length;

  // Column-count distribution: rows with the wrong field count are suspicious
  const colCountDist = {};
  for (const r of dataRows) {
    colCountDist[r.length] = (colCountDist[r.length] || 0) + 1;
  }

  const lines = [];
  const log = (s = '') => lines.push(s);

  log('='.repeat(80));
  log('SAKAN ALSAYD — RESIDENTS CSV PROFILE');
  log(`Generated: ${new Date().toISOString()}`);
  log(`Source:    ${path.relative(ROOT, CSV_PATH)}`);
  log('='.repeat(80));
  log();
  log(`Total parsed rows:  ${rows.length.toLocaleString()}`);
  log(`Header columns:     ${colCount}`);
  log(`Data rows:          ${dataRows.length.toLocaleString()}`);
  log();
  log('Column-count distribution across data rows:');
  for (const [k, v] of Object.entries(colCountDist).sort((a, b) => +a[0] - +b[0])) {
    const flag = +k === colCount ? ' (matches header)' : ' (MISMATCH)';
    log(`  ${k} fields: ${v.toLocaleString()} rows${flag}`);
  }
  log();

  // Per-column profile
  log('='.repeat(80));
  log('PER-COLUMN PROFILE');
  log('='.repeat(80));
  for (let c = 0; c < colCount; c++) {
    const name = header[c] || `(unnamed col ${c})`;
    const values = dataRows.map((r) => (r[c] ?? '').trim());
    const nonEmpty = values.filter((v) => v !== '');
    const distinctCounts = {};
    for (const v of nonEmpty) {
      distinctCounts[v] = (distinctCounts[v] || 0) + 1;
    }
    const distinct = Object.keys(distinctCounts).length;
    const lengths = nonEmpty.map((v) => v.length);
    const minLen = lengths.length ? Math.min(...lengths) : 0;
    const maxLen = lengths.length ? Math.max(...lengths) : 0;
    const avgLen = lengths.length ? (lengths.reduce((s, x) => s + x, 0) / lengths.length).toFixed(1) : '0';
    const cls = classify(nonEmpty);
    const top = topN(distinctCounts, 5);

    log();
    log(`[${c}] ${JSON.stringify(name)}`);
    log(`    non-empty: ${nonEmpty.length.toLocaleString()} / ${dataRows.length.toLocaleString()} (${pct(nonEmpty.length, dataRows.length)})`);
    log(`    distinct:  ${distinct.toLocaleString()}`);
    log(`    length:    min=${minLen} avg=${avgLen} max=${maxLen}`);
    if (cls.numeric)   log(`    numeric:   ${cls.numeric.toLocaleString()} (${pct(cls.numeric, nonEmpty.length)})`);
    if (cls.date)      log(`    date-ish:  ${cls.date.toLocaleString()} (${pct(cls.date, nonEmpty.length)})`);
    if (cls.phoneish)  log(`    phone-ish: ${cls.phoneish.toLocaleString()} (${pct(cls.phoneish, nonEmpty.length)})`);
    if (cls.emailish)  log(`    email-ish: ${cls.emailish.toLocaleString()} (${pct(cls.emailish, nonEmpty.length)})`);
    if (cls.multiline) log(`    multiline: ${cls.multiline.toLocaleString()} rows have embedded newlines`);
    if (top.length) {
      log(`    top values:`);
      for (const [val, count] of top) {
        const display = val.length > 80 ? val.slice(0, 77) + '...' : val;
        const safe = display.replace(/\n/g, '\\n');
        log(`      ${count.toString().padStart(5)}× ${JSON.stringify(safe)}`);
      }
    }
  }

  log();
  log('='.repeat(80));
  log('SAMPLE ROWS (first 3 data rows)');
  log('='.repeat(80));
  for (let i = 0; i < Math.min(3, dataRows.length); i++) {
    log();
    log(`-- row ${i + 1} --`);
    for (let c = 0; c < header.length; c++) {
      const v = (dataRows[i][c] ?? '').trim();
      if (v) {
        const display = v.length > 120 ? v.slice(0, 117) + '...' : v;
        const safe = display.replace(/\n/g, '\\n');
        log(`  [${c}] ${header[c]}: ${safe}`);
      }
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Profile written to ${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`(${dataRows.length.toLocaleString()} data rows, ${colCount} columns)`);
}

main();

#!/usr/bin/env node
// Stage 5 — show what "currently active" would be under several alternative
// status rules, all computed from the same transformed data. No DB writes.
//
// We iterate residents (already deduped by national_id) and look at each
// resident's MOST-RECENT stay (the chronologically last one) for the rule
// inputs. The output is just counts so you can pick the rule that matches
// reality.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRANSFORMED = path.join(__dirname, 'reports', '03-transformed.json');
const OUT = path.join(__dirname, 'reports', '05-status-rules.txt');

const TODAY = '2026-05-04';

function shiftMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

const data = JSON.parse(fs.readFileSync(TRANSFORMED, 'utf8'));
const residents = data.residents;

// pre-extract per-resident "signals" from the most-recent stay
const signals = residents.map((r) => {
  const recent = r.stays.find((s) => s.is_most_recent) || r.stays[r.stays.length - 1];
  return {
    name: r.full_name,
    national_id: r.national_id_or_iqama,
    stays: r.stays.length,
    has_supervisor_room: !!(recent.apartment && recent.room),
    contract_start: recent.contract_start,
    ejar_end: recent.ejar_end,
    ejar_active: recent.ejar_end ? recent.ejar_end >= TODAY : false,
  };
});

const cutoff6  = shiftMonths(TODAY, -6);
const cutoff12 = shiftMonths(TODAY, -12);
const cutoff18 = shiftMonths(TODAY, -18);
const cutoff24 = shiftMonths(TODAY, -24);

function count(predicate) {
  return signals.filter(predicate).length;
}

const lines = [];
const log = (s = '') => lines.push(s);

log('='.repeat(80));
log('STATUS-RULE EXPLORER');
log(`Today: ${TODAY}`);
log(`Total unique residents: ${residents.length.toLocaleString()}`);
log('='.repeat(80));
log('');
log('Each row shows: how many residents would be marked "active" if we used');
log('this rule. The right rule is the one whose count best matches reality.');
log('');

const rules = [
  {
    name: 'A. Ejar end >= today (current rule)',
    pred: (s) => s.ejar_active,
  },
  {
    name: `B. contract_start within last 6 months (>= ${cutoff6})`,
    pred: (s) => s.contract_start && s.contract_start >= cutoff6,
  },
  {
    name: `C. contract_start within last 12 months (>= ${cutoff12})`,
    pred: (s) => s.contract_start && s.contract_start >= cutoff12,
  },
  {
    name: `D. contract_start within last 18 months (>= ${cutoff18})`,
    pred: (s) => s.contract_start && s.contract_start >= cutoff18,
  },
  {
    name: `E. contract_start within last 24 months (>= ${cutoff24})`,
    pred: (s) => s.contract_start && s.contract_start >= cutoff24,
  },
  {
    name: 'F. Ejar end >= today  OR  contract_start within last 12 months',
    pred: (s) => s.ejar_active || (s.contract_start && s.contract_start >= cutoff12),
  },
  {
    name: 'G. Ejar end >= today  OR  contract_start within last 18 months',
    pred: (s) => s.ejar_active || (s.contract_start && s.contract_start >= cutoff18),
  },
  {
    name: 'H. Ejar end >= today  OR  contract_start within last 24 months',
    pred: (s) => s.ejar_active || (s.contract_start && s.contract_start >= cutoff24),
  },
  {
    name: 'I. Mark ALL residents as active (manager toggles checked_out manually)',
    pred: () => true,
  },
];

const totalLen = residents.length;
for (const r of rules) {
  const n = count(r.pred);
  const pct = ((n / totalLen) * 100).toFixed(1);
  log(`  ${n.toString().padStart(5).padEnd(5)}  (${pct.padStart(5)}%)  ${r.name}`);
}

log('');
log('Diagnostics on the underlying signals:');
log(`  residents with parseable Ejar end-date:  ${count((s) => s.ejar_end !== null).toLocaleString()}`);
log(`  residents with parseable contract_start: ${count((s) => s.contract_start !== null).toLocaleString()}`);
log(`  residents with NEITHER signal:           ${count((s) => !s.ejar_end && !s.contract_start).toLocaleString()}`);
log('');
log('Latest contract_start year breakdown (most-recent stay):');
const yearCounts = {};
for (const s of signals) {
  if (s.contract_start) {
    const y = s.contract_start.slice(0, 4);
    yearCounts[y] = (yearCounts[y] || 0) + 1;
  }
}
for (const [y, c] of Object.entries(yearCounts).sort()) {
  log(`  ${y}: ${c.toLocaleString()}`);
}

fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log(lines.join('\n'));
console.log('');
console.log(`Report: ${path.relative(path.resolve(__dirname, '..', '..'), OUT)}`);

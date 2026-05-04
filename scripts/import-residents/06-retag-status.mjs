#!/usr/bin/env node
// Stage 6 — non-destructive retag of resident statuses based on the latest
// transform output. Use this when only the status rule changed (no need to
// re-import resident records).
//
// Usage:
//   node scripts/import-residents/06-retag-status.mjs --target=dev   [--dry-run]
//   node scripts/import-residents/06-retag-status.mjs --target=prod  [--confirm-prod]
//
// Behaviour:
//   - Reads scripts/import-residents/reports/03-transformed.json
//   - For each transformed resident: looks up the DB row by
//     national_id_or_iqama (or phone if id missing) and runs an UPDATE
//     setting `status` if it differs.
//   - For any room_assignment whose status='active' but whose resident's new
//     status='checked_out', flips the assignment to 'ended'. (We never go the
//     other way — wouldn't want to trip the capacity trigger on bulk updates.)
//   - Writes a short audit report to reports/06-retag-<target>.txt.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const TRANSFORMED_PATH = path.join(__dirname, 'reports', '03-transformed.json');

const PROD_PROJECT_REF = 'xvcpyofwhmuohpvinrry';
const DEV_PROJECT_REF = 'xswagpwarqfdlbtkhlgz';

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
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const expectedRef = target === 'prod' ? PROD_PROJECT_REF : DEV_PROJECT_REF;
if (!SUPABASE_URL.includes(expectedRef)) {
  console.error('Error: env URL does not match expected project ref.');
  process.exit(2);
}

console.log(`→ target:  ${target}`);
console.log(`→ project: ${expectedRef}`);
console.log(`→ dry-run: ${dryRun}`);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const transformed = JSON.parse(fs.readFileSync(TRANSFORMED_PATH, 'utf8'));
console.log(`Loaded ${transformed.residents.length.toLocaleString()} residents from transform output.`);
console.log('');

// Step 1: build desired status map keyed by national_id and phone
const desiredByKey = new Map();
for (const r of transformed.residents) {
  if (r.national_id_or_iqama) desiredByKey.set(r.national_id_or_iqama, r.status);
  if (r.phone) desiredByKey.set(`phone:${r.phone}`, r.status);
}

// Step 2: pull all DB residents (paginated — Supabase caps at 1000/req)
const dbRows = [];
const pageSize = 1000;
for (let from = 0; ; from += pageSize) {
  const { data, error } = await supabase
    .from('residents')
    .select('id, national_id_or_iqama, phone, status')
    .range(from, from + pageSize - 1);
  if (error) {
    console.error('Failed to fetch DB residents:', error);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  dbRows.push(...data);
  if (data.length < pageSize) break;
}
console.log(`Fetched ${dbRows.length.toLocaleString()} DB residents.`);

// Step 3: compute UPDATEs
let toActive = [];     // ids flipping checked_out → active
let toCheckedOut = []; // ids flipping active → checked_out
let unchanged = 0;
let unmatched = 0;

for (const row of dbRows) {
  const want = (row.national_id_or_iqama && desiredByKey.get(row.national_id_or_iqama))
            || (row.phone && desiredByKey.get(`phone:${row.phone}`));
  if (!want) { unmatched++; continue; }
  if (want === row.status) { unchanged++; continue; }
  if (want === 'active') toActive.push(row.id);
  else if (want === 'checked_out') toCheckedOut.push(row.id);
}

console.log(`  to flip → active:       ${toActive.length.toLocaleString()}`);
console.log(`  to flip → checked_out:  ${toCheckedOut.length.toLocaleString()}`);
console.log(`  unchanged:              ${unchanged.toLocaleString()}`);
console.log(`  no-match in transform:  ${unmatched.toLocaleString()}`);

// Step 4: apply (chunked)
async function bulkSetStatus(ids, newStatus) {
  if (!ids.length) return 0;
  if (dryRun) return ids.length;
  let done = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const chunkIds = ids.slice(i, i + 200);
    const { error } = await supabase
      .from('residents')
      .update({ status: newStatus })
      .in('id', chunkIds);
    if (error) {
      console.error(`UPDATE chunk failed:`, error);
      process.exit(1);
    }
    done += chunkIds.length;
    process.stdout.write(`\r  → ${newStatus}: ${done}/${ids.length}`);
  }
  process.stdout.write('\n');
  return done;
}

console.log('');
console.log('Applying status updates…');
const setActive = await bulkSetStatus(toActive, 'active');
const setEnded = await bulkSetStatus(toCheckedOut, 'checked_out');

// Step 5: cascade — any room_assignment.status='active' whose resident is now
// 'checked_out' should also become 'ended'.
console.log('');
console.log('Cascading: flip active assignments belonging to now-checked_out residents…');
let cascaded = 0;
if (!dryRun && toCheckedOut.length) {
  const { error: cascadeErr } = await supabase
    .from('room_assignments')
    .update({ status: 'ended' })
    .eq('status', 'active')
    .in('resident_id', toCheckedOut);
  if (cascadeErr) {
    console.error('Cascade failed:', cascadeErr);
    process.exit(1);
  }
  // verify
  const { count } = await supabase
    .from('room_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  console.log(`  active assignments after cascade: ${count}`);
}

// Step 6: post-retag audit
console.log('');
console.log('Audit:');
const { count: rTotal } = await supabase.from('residents').select('*', { count: 'exact', head: true });
const { count: rActive } = await supabase.from('residents').select('*', { count: 'exact', head: true }).eq('status', 'active');
console.log(`  residents total:    ${rTotal}`);
console.log(`  residents active:   ${rActive}`);
console.log(`  residents checked_out: ${(rTotal || 0) - (rActive || 0)}`);

const summary = [
  '='.repeat(80),
  'STATUS RETAG AUDIT',
  `target: ${target}`,
  `dry-run: ${dryRun}`,
  `generated: ${new Date().toISOString()}`,
  '='.repeat(80),
  '',
  `flipped → active:       ${setActive}`,
  `flipped → checked_out:  ${setEnded}`,
  `unchanged:              ${unchanged}`,
  `unmatched in transform: ${unmatched}`,
  '',
  `residents total:        ${rTotal}`,
  `residents active:       ${rActive}`,
  `residents checked_out:  ${(rTotal || 0) - (rActive || 0)}`,
];
const auditPath = path.join(__dirname, 'reports', `06-retag-${target}.txt`);
fs.writeFileSync(auditPath, summary.join('\n') + '\n', 'utf8');
console.log(`Audit written to ${path.relative(ROOT, auditPath)}`);
console.log(dryRun ? '\n[dry-run complete]' : '\n[done]');

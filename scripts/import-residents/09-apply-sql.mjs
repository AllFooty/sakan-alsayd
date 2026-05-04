#!/usr/bin/env node
// Stage 9 — apply a generated .sql file to a Supabase project via the
// Management API (https://api.supabase.com/v1/projects/{ref}/database/query).
//
// Usage:
//   node scripts/import-residents/09-apply-sql.mjs --target=dev --file=path/to.sql
//   node scripts/import-residents/09-apply-sql.mjs --target=prod --file=path/to.sql --confirm-prod
//
// Reads SUPABASE_ACCESS_TOKEN from .env.development.local (dev) or .env.local
// (prod). The token must be a Personal Access Token (sbp_...).
//
// The Management API endpoint accepts a single query string and runs it inside
// its own transaction context — multi-statement queries with BEGIN/COMMIT are
// supported. On success it returns the result of the final statement.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const PROJECT_REFS = {
  dev: 'xswagpwarqfdlbtkhlgz',
  prod: 'xvcpyofwhmuohpvinrry',
};

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const target = args.target;
const filePath = args.file;
if (!target || !PROJECT_REFS[target]) {
  console.error('Error: --target=dev or --target=prod required');
  process.exit(1);
}
if (!filePath) {
  console.error('Error: --file=path/to.sql required');
  process.exit(1);
}
if (target === 'prod' && !args['confirm-prod']) {
  console.error('Error: applying to prod requires --confirm-prod');
  process.exit(1);
}

// SUPABASE_ACCESS_TOKEN is account-scoped (Personal Access Token), so it works
// against any project ref. Look in .env.local first, then .env.development.local.
let token = null;
for (const f of ['.env.local', '.env.development.local']) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const m = fs.readFileSync(p, 'utf8').match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
  if (m) {
    token = m[1].trim().replace(/^["']|["']$/g, '');
    break;
  }
}
if (!token) {
  console.error('Error: SUPABASE_ACCESS_TOKEN not found in .env.local or .env.development.local');
  process.exit(1);
}

const sqlPath = path.resolve(filePath);
if (!fs.existsSync(sqlPath)) {
  console.error(`Error: SQL file not found at ${sqlPath}`);
  process.exit(1);
}
const sql = fs.readFileSync(sqlPath, 'utf8');

const projectRef = PROJECT_REFS[target];
const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

console.log(`> Applying ${path.relative(ROOT, sqlPath)} to ${target} (${projectRef})`);
console.log(`  Size: ${sql.length} chars, statements (rough): ${(sql.match(/;\s*$/gm) || []).length}`);

const t0 = Date.now();
const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

console.log(`  HTTP ${res.status} in ${elapsed}s`);
if (!res.ok) {
  console.error('Error response:');
  console.error(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
  process.exit(2);
}
if (Array.isArray(body)) {
  console.log(`  Result rows: ${body.length}`);
  if (body.length && body.length <= 20) console.log(JSON.stringify(body, null, 2));
} else {
  console.log(JSON.stringify(body, null, 2));
}

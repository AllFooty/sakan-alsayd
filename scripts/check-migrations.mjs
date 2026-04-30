// Pre-deploy guard: verify every local migration in supabase/migrations/ is
// recorded on prod via the Supabase Management API.
// Run via `npm run check:migrations` (loads .env.local for SUPABASE_ACCESS_TOKEN).
//
// Background incident: maintenance form 500 caused by code shipping against
// migration 009 which was applied to dev but never to prod.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Migrations applied to prod before the supabase_migrations.schema_migrations
// table tracked them, OR whose recorded name diverges from the local filename.
// Listed here so the drift check ignores them. NEW migrations should be applied
// via apply_migration (which records the name) — only add to this set if a
// migration was applied out-of-band and you've manually verified prod state.
const HISTORICAL_APPLIED_OUT_OF_BAND = new Set([
  '001_schema.sql',                  // applied during initial project setup
  '002_rls.sql',                     // applied during initial project setup
  '004_booking_pipeline.sql',        // recorded remotely as "booking_pipeline_upgrade"
  '011_role_expansion_enum.sql',     // recorded with the leading "011_" prefix retained in the name
  '012_role_expansion_rls.sql',      // recorded with the leading "012_" prefix retained in the name
  '013_role_expansion_followup.sql', // recorded with the leading "013_" prefix retained in the name
  '016_buildings_photos_bucket.sql', // recorded with the leading "016_" prefix retained in the name
  '020_buildings_active_id_idx.sql', // applied via Dashboard SQL Editor; not registered in schema_migrations
  '021_rooms_capacity_and_mode.sql', // recorded with the leading "021_" prefix retained in the name
  '022_booking_select_for_maintenance_manager.sql', // applied via Dashboard SQL Editor; not registered in schema_migrations
  '023_rooms_capacity_mode_check.sql', // applied via Dashboard SQL Editor; constraint rooms_capacity_mode_check confirmed present on prod (42710 on re-apply)
  '024_residents_date_of_birth.sql',   // applied via Dashboard SQL Editor; column + index confirmed present on prod
  '025_maintenance_manager_full_update.sql', // applied via Dashboard SQL Editor; maintenance_manager_role_update policy confirmed present on prod
  '026_contracts_bucket.sql',          // applied via Dashboard SQL Editor; bucket + helper fn + 3 storage policies confirmed present on prod
  '027_residents_supervision_staff_and_capacity.sql', // applied via Dashboard SQL Editor; broadened RLS + uniq index + capacity trigger confirmed present on prod
  '028_apartments.sql',                // applied via apply_migration MCP; recorded with the leading "028_" prefix retained in the name
  '029_theme_preference.sql',          // applied via apply_migration MCP; recorded with the leading "029_" prefix retained in the name
]);

const PROJECT_REF = 'xvcpyofwhmuohpvinrry';

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
if (!accessToken) {
  console.error('Error: SUPABASE_ACCESS_TOKEN is not set.');
  console.error('');
  console.error('Create a Personal Access Token at:');
  console.error('  https://supabase.com/dashboard/account/tokens');
  console.error('');
  console.error('Then add it to .env.local:');
  console.error('  SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxx');
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

const localFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const localToCheck = localFiles
  .filter((f) => !HISTORICAL_APPLIED_OUT_OF_BAND.has(f))
  .map((f) => {
    const m = f.match(/^\d+_(.+)\.sql$/);
    return { file: f, name: m ? m[1] : null };
  })
  .filter((f) => f.name);

let appliedNames;
try {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/migrations`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    console.error(
      `Error querying Supabase Management API (HTTP ${res.status}):`
    );
    console.error(`  ${body.slice(0, 500)}`);
    if (res.status === 401 || res.status === 403) {
      console.error('');
      console.error('Token is invalid or lacks access to this project.');
      console.error('Re-issue at: https://supabase.com/dashboard/account/tokens');
    }
    process.exit(2);
  }
  const data = await res.json();
  appliedNames = new Set(data.map((m) => m.name));
} catch (err) {
  console.error('Error querying Supabase Management API:');
  console.error(`  ${err.message}`);
  process.exit(2);
}

const missing = localToCheck.filter((f) => !appliedNames.has(f.name));

if (missing.length === 0) {
  console.log(
    `OK — all ${localToCheck.length} tracked local migrations are applied to prod.`
  );
  process.exit(0);
}

console.error('Migration drift detected.');
console.error('These local migrations are NOT applied to production:');
for (const m of missing) console.error(`    ${m.file}`);
console.error('');
console.error('Apply them before deploying:');
console.error('  • via Claude Code (Supabase MCP apply_migration), or');
console.error('  • via Supabase Dashboard → SQL Editor.');
console.error('');
console.error('Then re-run: npm run check:migrations');
process.exit(1);

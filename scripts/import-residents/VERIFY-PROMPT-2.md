# Independent Verification Prompt — Sakan Alsayd Residents (Pass 2)

Paste everything below into a fresh AI session that has **read-only** access to
the dev Supabase project and to this repository. Do not let it write to the DB.

The original pass-1 prompt is at `scripts/import-residents/VERIFY-PROMPT.md`.
This pass-2 prompt exists because pass-1's reactivation step over-flipped: it
treated tenant_portal presence as a current-residency signal, but management
says tenant_portal is a stale portal-account list and the true active count
should be ~1,422, not the 2,228 the DB now shows.

---

## Prompt to paste

You are an independent auditor. The Sakan Alsayd dev DB
(`xswagpwarqfdlbtkhlgz`) has been through one round of corrections that we now
believe over-corrected. Your job: figure out, from the data sources available
to you, **which residents the DB currently flags as `active` are NOT actually
currently living in a building**, and **which auto-created rooms or
apartments are duplicates / artefacts that don't reflect reality**. Produce a
prioritized SQL diff a manager can apply.

You may NOT modify the DB or the source xlsx. You MAY use the Supabase MCP for
read-only SQL, and you MAY parse the xlsx and CSVs in the repo. Surface every
direction of disagreement, not just the cases where the DB is wrong.

### Management-asserted ground truth (authoritative)

These are what a real-world manager said is true, and they should be your
North Star whenever the DB conflicts:

1. **Total currently active residents ≈ 1,422.** The DB currently shows 2,228
   active. The delta of ~806 is concentrated in the residents bulk-flipped
   on 2026-05-04 and stamped with `[Reactivated 2026-05-04 from tenant_portal]`
   in `residents.notes`. Those flips are reversible — see
   `scripts/import-residents/reports/verify/status_flips_dev.sql` for the
   exact reversal recipe.
2. **Khobar Andalous building has 76 rooms.** That is the on-the-ground room
   count. The DB currently has more rooms in `khobar-alandalus` than that —
   query and surface the overcount.
3. (If the manager gives you any other building-level numbers, treat them
   the same way.)

You are encouraged to ask for *additional* per-building room counts before
you finalize the report — they are the cheapest way to disambiguate which
auto-created INTAKE-* and INTAKE-REACT-* rooms should be deleted vs. kept.

### What's been done to the DB so far (so you don't double-correct)

All applied to dev only on 2026-05-04, all idempotent, all in the residents
import audit project:

1. **Initial import (2026-05-04)**: 4,044 residents from a Google Forms CSV;
   1,440 active by an "Ejar end-date OR contract within 18 months" rule.
   Each active got a placeholder `INTAKE` apartment row (`is_active=false`),
   `INTAKE-N` rooms with capacity 20.
2. **Blacklist remediation**: 18 actives flipped to `checked_out`,
   `room_assignments` ended `2026-05-04`, 63 distinct residents stamped
   `[Black list] …` in notes. (Source: blacklist sheet, ID-equality matches.)
3. **INTAKE → real-room migration**: 266 active residents moved off
   `INTAKE-*` rooms to real apt+room derived from supervisor comments. 76
   new apartments + 132 new rooms auto-created with notes prefixed
   `[Auto-created INTAKE migration 2026-05-04. …]`, `monthly_price=0`.
4. **Phone fills (7)**: residents with `phone='0000000000'` updated to xlsx
   `applications` phones.
5. **DOB fills (2)**: residents with `date_of_birth IS NULL` updated where
   xlsx had a real ISO date (the other 56 audit-flagged rows had emails in
   that column — ignored).
6. **Default-building -1/-2 swaps (2)**: two residents moved from
   `khobar-alrakah` to a freshly-created `khobar-alrakah-2` INTAKE.
7. **Status flips from tenant_portal (806)** ← **this is the suspect step**.
   - 118 residents moved from `checked_out` to `active` AND given a fresh
     `room_assignment` in 8 brand-new `INTAKE-REACT-N` rooms (capacity 20,
     marked `[Auto-created INTAKE-REACT room for status-flip 2026-05-04]`)
     across 5 buildings. Their `residents.notes` contains
     `[Reactivated 2026-05-04 from tenant_portal]`.
   - 688 residents moved to `active` with a "needs manual room assignment"
     stamp and **no** active assignment. Their notes contain
     `[Reactivated 2026-05-04 from tenant_portal — needs manual room assignment]`.

The reactivation step's input was
`scripts/import-residents/reports/verify/checks/check5_db_checkedout_xlsx_active.csv` —
residents marked `checked_out` in the DB at audit time who matched a
tenant_portal row by phone or name-token-key.

### What to investigate

#### 1. Reactivation triage (highest priority)

For each of the 806 residents stamped with
`[Reactivated 2026-05-04 from tenant_portal%]`:

a. Look at every other signal you have:
   - `applications` xlsx (Google Form raw): is there a recent contract date
     (within 12 months)? An end-date past today (2026-05-04)?
   - `deductions` xlsx: only ~12 of 1,916 rows have real names; flag a
     resident as deductions-corroborated **only** if their name/id/phone
     matches one of those 12.
   - `blacklist` xlsx: if blacklisted, they are clearly NOT current. (Note:
     the blacklist remediation step has already stamped these — check that
     your reactivation list and the blacklist set don't intersect; if they
     do, the reactivation took precedence and is wrong.)
   - `transport.csv`: a recent transport request implies presence.
   - `supervisor` comments in `applications` row that look dated (e.g.
     "تم الدخول بتاريخ 28 نوفمبر 2025"): treat dated entries within the last
     12 months as "currently here", older or absent dates as "not here now".

b. Classify each reactivated resident into one of:
   - **`keep_active`** — multiple independent signals say currently here.
   - **`probable_revert`** — only tenant_portal supports active; no other
     evidence; date signals (if any) are >12 months stale.
   - **`uncertain`** — tenant_portal + something else weak (e.g. an
     unparseable supervisor comment); leave for manual review.

c. Target counts that should fall out of this triage if the management
   number is right:
   - keep_active should be very small (likely <50).
   - probable_revert should be ~750–800.
   - uncertain should be small.

d. Output a CSV at
   `reports/verify/checks/check_reactivation_triage.csv` with columns:
   `resident_id, name, phone, national_id, classification,
   evidence_summary` — `evidence_summary` is one short line per resident
   listing what signals agreed (e.g.
   "tenant_portal=yes; applications_dob=null; supervisor_comment=ش12 غ1
   ثنائي 2024 (>12mo old); blacklist=no").

#### 2. Andalous (and other buildings) — room/apartment overcount

a. Count rooms per building. For `khobar-alandalus`, the DB count is
   higher than 76 — list every "extra" room with: `apartment_number`,
   `room_number`, `capacity`, `notes`, and the count of *currently active*
   `room_assignments` referencing it. Group by likely cause:
   - INTAKE-N placeholders (`apartment_number = 'INTAKE'`)
   - INTAKE-REACT-N from the 2026-05-04 reactivation
   - Auto-created rooms from the INTAKE-migration step (notes contain
     `[Auto-created INTAKE migration 2026-05-04]`)
   - Genuine duplicate or near-duplicate rooms (same apartment, similar
     room_number)
   - Real rooms that pre-existed and are legitimate

b. For each "extra" room: propose either DELETE (if it has zero active
   assignments and is clearly an artefact) or MERGE (if it duplicates an
   existing real room and assignments need to be re-pointed first).

c. Repeat the count check for every building so we catch the same problem
   elsewhere. Flag any building where the auto-created room count is more
   than 10% of the total — those are candidates for over-creation.

#### 3. Active-without-assignment audit

The 688 manual-stamped reactivations have `status='active'` but no active
`room_assignment`. After section 1 reverts the wrongly-flipped ones, count
how many of the survivors are still in this state. Surface them grouped by
their tenant_portal branch (joined back through `applications` or
`tenant_portal` raw rows) so a manager can place them.

#### 4. Cross-checks the previous audit did NOT do

- **Hijri DOB contamination.** Some `residents.date_of_birth` rows store
  Hijri years as Gregorian (e.g. `1425-03-12`, `1431-05-17`). Run
  `SELECT count(*), min(date_of_birth), max(date_of_birth) FROM residents
  WHERE date_of_birth < '1900-01-01';` and surface the affected set.
- **Phone duplicates with national_id mismatch.** The 50 phone-dup pairs
  the original audit found — re-check after the cleanup. Some may now be
  unified, others may not.
- **`is_active=false` apartments with `is_active=true` rooms.** Sanity
  check: does the DB allow this? If yes, surface any cases — they will
  cause UI confusion.

### Deliverable format

Produce a single markdown report at
`scripts/import-residents/reports/verify/REPORT-2.md` with these sections:

1. **Executive summary** — one paragraph + counts table. Must answer:
   "if all `probable_revert` reactivations are reverted, what does
   `count(*) WHERE status='active'` become? Does that match the
   management-asserted ~1,422?"
2. **Reactivation triage** — counts per classification, top 20 examples
   per class, link to the full CSV.
3. **Andalous overcount** — table of extra rooms, count per cause,
   proposed actions.
4. **All-buildings room health** — one row per building with: room count,
   auto-created room count, active assignments, manager-asserted ground
   truth (blank if not given).
5. **Active-without-assignment** — count per branch.
6. **Cross-checks** — Hijri DOBs, phone duplicates, apartment/room is_active
   inconsistencies.
7. **Recommended SQL**, grouped Critical / High / Medium. Use the same
   `BEGIN; … ROLLBACK;` shape as the existing remediation files in
   `scripts/import-residents/reports/verify/`. The reactivation reversal
   recipe at the top of `status_flips_dev.sql` is your starting point —
   adapt it to revert only the `probable_revert` IDs, not the whole 806.

### Constraints

- Read-only against Supabase. The helper at
  `scripts/import-residents/09-apply-sql.mjs` exists for write-paths — do
  not invoke it.
- Don't trust either the DB or any single xlsx sheet blindly. Combine
  signals.
- The original audit's evidence CSVs are in
  `scripts/import-residents/reports/verify/checks/` — re-use them rather
  than re-deriving.
- If a column in the xlsx is unclear, list it under "Ambiguous source
  data" at the top and ask before assuming.
- Cite every count you produce with the SQL or CSV row range that backs
  it, so a manager can reproduce.

Begin by:

1. Counting `residents` by status, by `notes LIKE '%[Reactivated 2026-05-04%'`,
   and by `notes LIKE '%[Black list]%'`. Confirm the numbers in the
   "what's been done" section match.
2. Counting rooms per building, especially `khobar-alandalus`. Print the
   delta from the management-asserted 76.
3. Asking the user for any additional management-asserted building room
   counts before proceeding to the full triage.

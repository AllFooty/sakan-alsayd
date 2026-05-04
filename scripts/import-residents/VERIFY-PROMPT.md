# Independent Verification Prompt — Sakan Alsayd Residents Import

Copy everything below into the second AI session. Paste your verification xlsx
into the same workspace as `data/residents-verify.xlsx` (or update the path in
the prompt) before running.

---

## Prompt to paste

You are an independent auditor. A previous import populated the **Sakan Alsayd**
residents database from a Google-Forms CSV (~5,000 form submissions → 4,044
unique residents). I am giving you a second xlsx file (`data/residents-verify.xlsx`)
that contains a different — and we believe more authoritative — view of the
same residents. **Your job: verify the imported DB against the xlsx, and report
every discrepancy.** Do not trust either source blindly; flag both directions.

### What's in the database

The DB is on Supabase. Use the Supabase MCP if available, otherwise read-only
SQL via whatever tool you have. Project refs:

- **dev**: `xswagpwarqfdlbtkhlgz`  ← verify here first
- **prod**: `xvcpyofwhmuohpvinrry`  ← do **not** modify; verify only after dev signoff

Relevant tables:

```
residents            (id, full_name, phone, email, national_id_or_iqama,
                      nationality, date_of_birth, university_or_workplace,
                      emergency_contact_phone, status ['active'|'checked_out'|'suspended'],
                      notes, created_at)

room_assignments     (id, resident_id, room_id, building_id, check_in_date,
                      check_out_date, status ['active'|'ended'])

apartments           (id, building_id, apartment_number, floor, is_active, notes)
rooms                (id, apartment_id, building_id, room_number, room_type,
                      bathroom_type, capacity, occupancy_mode, monthly_price,
                      status, notes)
buildings            (id, slug, city_en, city_ar, neighborhood_en, neighborhood_ar,
                      is_active, is_placeholder)
activity_log         (action, entity_type, entity_id, details, created_at)
```

Buildings (slug → name → id-tail):
- `khobar-alolaya` (Al-Olaya 1, …001) `khobar-alolaya-2` (…009)
- `khobar-alandalus` (…002)
- `khobar-alrakah` (Al-Rakah 1, …003) `khobar-alrakah-2` (…010)
- `dammam-alaziziah` (Al-Safa, Dammam, …004)
- `jubail-jalmudah` (…005)
- `riyadh-alyarmouk-1` (…006) `riyadh-alyarmouk-2` (…007, currently unused)
- `riyadh-alaridh` (Al-Aridh 1, …008) `riyadh-alaridh-2` (…011)

### What was imported (so you know what "correct" should look like)

- **4,044 unique residents** deduped from 5,030 form submissions by
  `national_id_or_iqama` (with `phone` fallback for the few without an ID).
- Status rule: a resident is `active` iff their most-recent stay has either
  (a) Ejar end-date ≥ today (2026-05-04), or (b) `contract_start` within the
  last 18 months. Otherwise `checked_out`. Today: **2026-05-04**.
- 1,440 active / 2,604 checked_out.
- Each active resident has one placeholder `room_assignment` in an INTAKE
  apartment per building. The apartment is named `INTAKE`, marked
  `is_active=false`. Rooms are `INTAKE-1`, `INTAKE-2`, … capacity 20.
- 158 of the 1,440 actives have a real auto-created apartment+room (parsed
  from supervisor comments in the CSV).
- 848 of 1,440 actives had **ambiguous** CSV building strings (e.g. plain
  "العليا - الخبر" with no 1/2). They were defaulted to building `-1` of that
  neighborhood, with the original Arabic string preserved in `residents.notes`.
- Nationality inferred from national_id prefix: starts with `1` → "سعودية"
  (Saudi), starts with `2` → "غير سعودية" (non-Saudi). 96.9% covered.
- 3 new buildings created: `khobar-alolaya-2`, `khobar-alrakah-2`,
  `riyadh-alaridh-2` (all `is_active=false` until manually turned on).

### What I need you to verify against the xlsx

For every check below, report **direction** (DB has but xlsx doesn't / xlsx
has but DB doesn't / both have but disagree), **count**, and **first 20
examples** with their identifiers (national_id and full_name). Do not
truncate to ≤5 — I need 20 per category to spot-check.

#### 1. Resident-level reconciliation
Match xlsx rows to DB rows on `national_id_or_iqama` first, falling back to
phone (normalize Saudi mobile to `0XXXXXXXXX`), then to fuzzy full_name.
For each matched pair, compare:
- full_name (note: spaces and diacritics may differ — flag only if substantively different)
- phone (normalized)
- email (lowercased, trimmed)
- date_of_birth
- nationality
- status
- university_or_workplace

Report:
- xlsx rows with **no DB match** at all (identify by id/phone/name)
- DB rows with **no xlsx match**
- Matched pairs with **conflicting fields** (one row per conflict, listing the field, DB value, xlsx value)

#### 2. Duplicate checks
- Duplicates **inside** the DB:
  - Same `national_id_or_iqama` appearing on more than one row → list pairs
  - Same `phone` (normalized) appearing on more than one row, where
    `national_id_or_iqama` differs → potential identity collision
- Duplicates **inside** the xlsx (same checks)
- **Cross-source mismatches**: the xlsx claims two different people share the
  same national_id, but DB has them as one — surface this clearly.

#### 3. Building / room reconciliation
For each resident the xlsx claims is **currently active in a specific
building/apartment/room**:
- Does the DB show them with status `active`? If not, why (xlsx says active
  but DB says checked_out → flag)
- Does the DB's active `room_assignment` point to the same building? Note:
  if the DB assignment is in an `INTAKE` apartment, the resident is "in the
  right building but not the right room" — flag as
  `intake_pending_real_room`, not as a hard mismatch.
- Are apartment/room numbers matching where both sides have specifics?

#### 4. Building defaults audit
The 848 residents whose CSV building was ambiguous were defaulted to building
-1 of their neighborhood. For each defaulted resident, check whether the xlsx
has an authoritative building. Specifically count:
- Defaulted to `khobar-alolaya` but xlsx says `khobar-alolaya-2`
- Defaulted to `riyadh-alaridh` but xlsx says `riyadh-alaridh-2`
- Defaulted to `khobar-alrakah` but xlsx says `khobar-alrakah-2`
For each, list the residents that need manual reassignment.

#### 5. Status sanity
- Residents marked `checked_out` in DB but who appear in xlsx as currently
  living → potential false-negatives caused by the 18-month rule
- Residents marked `active` in DB but xlsx shows as departed → false-positives
- Residents in xlsx not in DB at all (might be very recent move-ins missed by
  the CSV cutoff)

#### 6. Data quality flags
- DB residents where `phone = '0000000000'` (placeholder for missing) — does
  the xlsx supply a real phone?
- DB residents where `nationality IS NULL` (the 126 residents whose ID didn't
  start with 1 or 2) — does the xlsx have nationality?
- DB residents where `date_of_birth IS NULL` — does the xlsx supply one?

#### 7. INTAKE cleanup signal
Count for each building:
- residents currently in an INTAKE room (`apartments.apartment_number = 'INTAKE'`)
- of those, how many does the xlsx provide a real apartment+room for
- These are the highest-value manual-move targets — list them grouped by
  destination apartment.

### Output format

Produce a single markdown report with these sections:

1. **Executive summary** — one paragraph + a counts table (DB total, xlsx
   total, matched, DB-only, xlsx-only, conflicts, duplicates).
2. **Resident-level reconciliation** — per check #1.
3. **Duplicate report** — per check #2.
4. **Building/room reconciliation** — per check #3 + #4 + #7.
5. **Status discrepancies** — per check #5.
6. **Data quality gaps the xlsx can fill** — per check #6.
7. **Recommended manual fixes**, grouped by priority (Critical / High /
   Medium / Low). For each, give the exact SQL or admin-UI action a manager
   should take.

Do **not** modify the database. Do **not** modify the xlsx. This is a
read-only audit.

If anything in the xlsx is unclear (e.g. a column you can't interpret), list
those columns at the top of the report under "Ambiguous source data" and
ask the user before proceeding with assumptions about that column.

### Constraints

- Read-only against Supabase. No writes, no migrations, no DELETEs/UPDATEs.
- If the xlsx is large (>10k rows) and your tool can't parse it natively,
  convert to CSV first via `xlsx2csv` or pandas, but keep the original.
- Do not skip rows because they look "weird" — surface every weird row.
- Don't grade me on whether the import was good or bad. Tell me where the DB
  and xlsx agree, where they don't, and what an admin should do to reconcile.

Begin by counting rows in both sources and printing a one-sentence
description of the xlsx columns, then proceed through the checklist above.

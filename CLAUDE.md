# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Next.js dev server (use port 3001: npx next dev -p 3001)
npm run build          # Production build
npm run lint           # ESLint
npm run build:worker   # Cloudflare Workers build (opennextjs-cloudflare)
npm run preview        # Build + local Cloudflare preview (wrangler dev)
npm run check:migrations  # Verify local migrations match prod (runs automatically before deploy)
npm run deploy         # Build + deploy to Cloudflare Workers (aborts if migration drift detected)
```

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + Supabase + Cloudflare Workers

**Bilingual (AR/EN):** Default locale is Arabic (`ar`). All routes are under `src/app/[locale]/`. Translations live in `src/messages/ar.json` and `src/messages/en.json`. Use `useTranslations()` from next-intl in components. The i18n config is in `src/i18n/config.ts` and `src/i18n/request.ts`; the Next.js plugin is wired in `next.config.ts`.

**RTL support:** Arabic renders RTL. Use `getDirection(locale)` from `src/lib/utils.ts`. Global CSS includes `[dir="rtl"]` selectors for layout adjustments.

### Supabase Clients

Four client variants in `src/lib/supabase/`:

| File | Use in | Purpose |
|------|--------|---------|
| `client.ts` | Browser components | `createClient()` — cookie-based auth |
| `server.ts` | Server components/actions | `createClient()` — reads cookies from request |
| `admin.ts` | API routes needing elevated access | `createAdminClient()` — service role key, bypasses RLS |
| `middleware.ts` | `src/middleware.ts` | `updateSession()` — refreshes auth session |

### Auth System (`src/lib/auth/`)

- **Roles:** `super_admin`, `branch_manager`, `maintenance_staff`, `transportation_staff`, `supervision_staff`, `finance_staff`
- **Server guards** (`guards.ts`): `getAuthenticatedStaff(locale)`, `requireRole(locale, ...roles)`, `getAssignedBuildingIds(staffId)`
- **API guards** (`api-guards.ts`): `authenticateApiRequest(...allowedRoles)` returns `{user, profile, supabase}` or a NextResponse error. Check with `isAuthError()`.
- **Client context** (`providers.tsx`): `AuthProvider` wraps admin layout. Use `useAuth()` hook for user/profile/signOut.

### API Route Auth Pattern

Every admin API route follows this pattern:
```typescript
const authResult = await authenticateApiRequest('super_admin', 'branch_manager');
if (isAuthError(authResult)) return authResult;
const { user, profile, supabase } = authResult;
```

### Routing Structure

- **Public site:** `src/app/[locale]/page.tsx`, `buildings/[id]`, `testimonials`
- **Admin portal:** `src/app/[locale]/admin/` — bookings, maintenance, residents, buildings, content, settings
- **API:** `src/app/api/` — booking-requests, maintenance-requests, contact, buildings, auth, uploads, admin/dashboard-stats
- **Middleware** (`src/middleware.ts`): Runs next-intl for locale routing, then checks Supabase session for admin routes (skips `/admin/login`)

### Key UI Patterns

- **Forms:** react-hook-form + zod validation, submitted via fetch to API routes, sonner toasts for feedback
- **Admin lists:** Filter/search/export support, bulk actions via `BulkActionBar`
- **Pipeline steppers:** `BookingPipelineStepper` and `MaintenancePipelineStepper` visualize request status flow
- **Shared admin components:** `StatusBadge`, `EmptyState`, `ConfirmDialog`, `LoadingScreen`, `AdvancedFilters` in `src/components/admin/shared/`
- **Utility:** `cn()` for classname merging (clsx + tailwind-merge) in `src/lib/utils.ts`

## Project Rules

- **ALWAYS use Western Arabic numerals (0-9)** — never Eastern/Indian numerals. Use `en-US` locale for `Intl.NumberFormat`, not `ar-SA`.
- **Brand colors:** coral `#C75B5B` (primary), navy `#1A3A5A` (secondary), cream `#F5F0EB` (background) — defined as CSS custom properties in `globals.css`.
- **Fonts:** IBM Plex Sans Arabic (`--font-arabic`) and IBM Plex Sans (`--font-english`), loaded via next/font in `src/app/[locale]/layout.tsx`.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon/publishable key
SUPABASE_SERVICE_ROLE_KEY      # Supabase service role key (server-only)
SUPABASE_ACCESS_TOKEN          # Personal Access Token (for predeploy migration drift check)
```

Dev credentials go in `.env.development.local`, production in `.env.local`.

`SUPABASE_ACCESS_TOKEN` is only used by `scripts/check-migrations.mjs` (predeploy hook). It's a Personal Access Token, not a project API key. Generate one at https://supabase.com/dashboard/account/tokens and paste into `.env.local` as `SUPABASE_ACCESS_TOKEN=sbp_...`. The script calls the Supabase Management API to list applied migrations on the prod project.

## Deploying schema changes

The codebase ships against a specific Supabase schema. Skipping the prod migration step causes 500s in production (incident reference: maintenance form 500 traced to migration 009 applied to dev but not prod).

**Workflow for any new migration:**

1. **Write the migration** in `supabase/migrations/NNN_name.sql`. Use the next sequential number; the stem after `NNN_` becomes the migration name registered in `supabase_migrations.schema_migrations`, so make it descriptive.
2. **Apply to dev** Supabase branch (`xswagpwarqfdlbtkhlgz`) via Claude Code's Supabase MCP `apply_migration` (preferred) or Supabase Dashboard → SQL Editor. Verify your changes work end-to-end against dev.
3. **Apply to prod** Supabase project (`xvcpyofwhmuohpvinrry`) via the same mechanism. Confirm with `mcp__supabase__list_migrations` that the version is recorded.
4. **Deploy code** with `npm run deploy`. The `predeploy` hook runs `scripts/check-migrations.mjs`, which queries the prod migrations table and aborts the deploy if any local migration is missing on prod.

**If a migration was applied via SQL Editor** (and thus has a different recorded name than its local filename suggests, or wasn't recorded at all), add the local filename to `HISTORICAL_APPLIED_OUT_OF_BAND` in `scripts/check-migrations.mjs` so future drift checks ignore it. Always prefer `apply_migration` going forward — it records the exact filename stem as the name and avoids this divergence.

**Manual drift check anytime**: `npm run check:migrations`.

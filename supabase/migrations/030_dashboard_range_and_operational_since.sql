-- Migration 030: time-range-aware dashboard counters + operational_since
--
-- Two changes shipped together:
--
-- 1. buildings.operational_since (DATE)
--    The system is being introduced to a portfolio of buildings that have
--    operated for years. `created_at` reflects when the row was inserted,
--    not when the building actually came online. Adding a separate
--    operational_since column lets super_admin override the truth value
--    so that any future flow KPI ("buildings added this month") doesn't
--    falsely count pre-existing buildings as new.
--
--    The default value uses created_at::date so existing rows stay
--    consistent on backfill, and new rows continue to default to today
--    (created_at::date). Editable by API only (super_admin gate enforced
--    in the route handler, not RLS).
--
-- 2. dashboard_counters(p_from, p_to) — replaces the no-arg version.
--    Flow KPIs (new_bookings, completed_maintenance) are scoped to the
--    [p_from, p_to] window. Snapshot KPIs (total_buildings,
--    active_residents) ignore the window. open_maintenance becomes a
--    flow indicator: requests created within range whose status is
--    still in (submitted, assigned, in_progress).
--
--    NULL parameters fall back to (now() - interval '30 days', now()),
--    so callers that don't pass a range get the audit-recommended
--    30-day default.

-- ----------------------------------------------------------------------------
-- 1. operational_since
-- ----------------------------------------------------------------------------

ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS operational_since DATE;

UPDATE public.buildings
   SET operational_since = created_at::date
 WHERE operational_since IS NULL;

ALTER TABLE public.buildings
  ALTER COLUMN operational_since SET DEFAULT CURRENT_DATE,
  ALTER COLUMN operational_since SET NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. dashboard_counters(p_from, p_to)
-- ----------------------------------------------------------------------------

-- Drop the no-arg version cleanly so the new signature can take its place.
DROP FUNCTION IF EXISTS public.dashboard_counters();

CREATE OR REPLACE FUNCTION public.dashboard_counters(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to   TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  new_bookings     BIGINT,
  open_maintenance BIGINT,
  total_buildings  BIGINT,
  active_residents BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH range AS (
    SELECT
      COALESCE(p_from, now() - interval '30 days') AS from_ts,
      COALESCE(p_to,   now())                       AS to_ts
  )
  SELECT
    (SELECT COUNT(*) FROM public.booking_requests, range
       WHERE created_at >= range.from_ts
         AND created_at <= range.to_ts)::bigint AS new_bookings,
    (SELECT COUNT(*) FROM public.maintenance_requests, range
       WHERE status IN ('submitted', 'assigned', 'in_progress')
         AND created_at >= range.from_ts
         AND created_at <= range.to_ts)::bigint AS open_maintenance,
    (SELECT COUNT(*) FROM public.buildings
       WHERE is_active = true)::bigint AS total_buildings,
    (SELECT COUNT(*) FROM public.residents
       WHERE status = 'active')::bigint AS active_residents;
$$;

REVOKE ALL ON FUNCTION public.dashboard_counters(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_counters(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- The pre-existing partial indexes on bookings/maintenance status remain
-- useful for snapshot reads elsewhere, but the new function ranges by
-- created_at — which already has implicit btree coverage via the primary
-- key clustering. No new index needed at current data volumes; revisit if
-- booking/maintenance tables exceed ~100k rows.

-- Migration 015: Dashboard counters function + supporting partial indexes
--
-- Purpose
-- -------
-- The admin dashboard at /api/admin/dashboard-stats currently fires four
-- `count: 'exact'` Supabase queries (booking_requests, maintenance_requests,
-- buildings, residents). Each one performs a sequential scan of the whole
-- table to satisfy the exact-count semantics, which gets steadily worse as
-- those tables grow.
--
-- This migration replaces the four scans with:
--   1. A single Postgres function `public.dashboard_counters()` that returns
--      all four counts in one round-trip.
--   2. Four partial indexes over exactly the predicates the function counts,
--      so each subselect becomes an index-only count (O(log n) seek + a
--      tight scan over only the matching rows, instead of the whole table).
--
-- SECURITY DEFINER rationale
-- --------------------------
-- The function is declared SECURITY DEFINER STABLE. SECURITY DEFINER lets it
-- bypass RLS to perform aggregate counts on these tables. That is acceptable
-- here because:
--   * The function only returns four bigint counts -- no row data, no PII,
--     no foreign keys, no leak of which tenant/branch a record belongs to.
--   * The endpoint that calls it (/api/admin/dashboard-stats) is already
--     gated by `authenticateApiRequest('branch_manager')`, which only lets
--     super_admin / deputy_general_manager / branch_manager roles through.
--   * EXECUTE is granted ONLY to the `authenticated` role, so anonymous
--     traffic cannot invoke it directly.
-- STABLE (not IMMUTABLE) is correct because the result depends on table
-- contents that change between calls.

CREATE OR REPLACE FUNCTION public.dashboard_counters()
RETURNS TABLE (
  new_bookings BIGINT,
  open_maintenance BIGINT,
  total_buildings BIGINT,
  active_residents BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.booking_requests
       WHERE status = 'new')::bigint AS new_bookings,
    (SELECT COUNT(*) FROM public.maintenance_requests
       WHERE status IN ('submitted', 'assigned', 'in_progress'))::bigint AS open_maintenance,
    (SELECT COUNT(*) FROM public.buildings
       WHERE is_active = true)::bigint AS total_buildings,
    (SELECT COUNT(*) FROM public.residents
       WHERE status = 'active')::bigint AS active_residents;
$$;

-- Lock down default execution and grant only to authenticated end users.
REVOKE ALL ON FUNCTION public.dashboard_counters() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_counters() TO authenticated;

-- Partial indexes that exactly match each subselect's WHERE clause. Postgres
-- can satisfy the COUNT(*) directly from the index, and the index itself
-- contains only the matching rows, so it stays small even as the parent
-- table grows.
CREATE INDEX IF NOT EXISTS idx_bookings_status_new
  ON public.booking_requests (status)
  WHERE status = 'new';

CREATE INDEX IF NOT EXISTS idx_maintenance_status_open
  ON public.maintenance_requests (status)
  WHERE status IN ('submitted', 'assigned', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_residents_status_active
  ON public.residents (status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_buildings_is_active_true
  ON public.buildings (is_active)
  WHERE is_active = true;

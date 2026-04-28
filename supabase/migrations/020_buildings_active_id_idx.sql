-- ============================================================================
-- Migration 020: Index supporting rooms_anon_select RLS policy
-- ============================================================================
-- The rooms_anon_select policy in 002_rls.sql:113-115 runs an EXISTS subquery
-- against buildings for every row of rooms it evaluates. With more rooms this
-- becomes a hot O(R × B) path on the public detail page. A partial index on
-- buildings(id) WHERE is_active = true keeps the EXISTS check index-only.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_buildings_active_id
  ON public.buildings (id)
  WHERE is_active = true;

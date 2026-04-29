-- ============================================================================
-- Migration 025: Grant maintenance_manager building-scoped UPDATE on
-- maintenance_requests (separate from the per-assignment maintenance_staff rule).
-- ============================================================================
--
-- Before this migration, `maintenance_staff_update` (set in 012) gated UPDATE
-- for both `maintenance_staff` and `maintenance_manager` on
-- `assigned_to = auth.uid()`. That meant a maintenance_manager could only
-- update requests personally assigned to them — not requests assigned to
-- their technicians, blocking status transitions, reassignments, and resolution
-- notes for the rest of the team's work.
--
-- The API (src/app/api/maintenance-requests/[id]/route.ts:47-53,
-- src/app/api/maintenance-requests/bulk/route.ts:9-14) already accepts the
-- maintenance_manager role; the missing piece was at the RLS layer.
--
-- Fix:
--   1. Tighten `maintenance_staff_update` so it applies only to
--      maintenance_staff (the per-assignment rule still makes sense for
--      individual technicians).
--   2. Add `maintenance_manager_role_update` granting maintenance_manager
--      UPDATE on any maintenance_request whose building they're assigned to,
--      mirroring the building-scoped access branch_manager has via
--      `maintenance_manager_update` (the legacy 002/013 policy that's
--      role-gated to branch_manager).
--
-- Result: maintenance_manager has the same UPDATE surface as branch_manager
-- (building-scoped); maintenance_staff stays at per-assignment.
-- ============================================================================

DROP POLICY IF EXISTS "maintenance_staff_update" ON public.maintenance_requests;
CREATE POLICY "maintenance_staff_update" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'maintenance_staff'
    AND assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS "maintenance_manager_role_update" ON public.maintenance_requests;
CREATE POLICY "maintenance_manager_role_update" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'maintenance_manager'
    AND public.is_assigned_to_building(building_id)
  );

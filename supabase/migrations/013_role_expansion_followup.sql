-- ============================================================================
-- Migration 013: Role expansion follow-up — close gaps surfaced by review
-- ============================================================================
-- Three classes of fixes:
--
--   1. CRITICAL — block self-promotion via the staff_update_own RLS policy.
--      The existing policy lets users UPDATE any column on their own row.
--      With deputy_general_manager added in 011/012 (a near-super_admin tier),
--      a non-admin user could self-promote via the cookie-bound supabase
--      client and instantly gain has_admin_access() across the data plane.
--      We add a BEFORE UPDATE trigger that aborts when auth.uid() = OLD.id
--      AND role/is_active changes. The admin API uses createAdminClient
--      (service role; auth.uid() = NULL), so legitimate admin updates pass.
--
--   2. CRITICAL/HIGH — tighten the legacy `*_manager_*` RLS policies that
--      were named after `branch_manager` but never role-checked. Any building-
--      assigned user (now including the new manager-tier roles) inherited
--      cross-domain CRUD on buildings/rooms/residents/room_assignments and
--      maintenance_requests. We add an explicit `branch_manager` role guard
--      to each so the design intent ("manager peer == staff peer access")
--      holds and the new role-restricted policies in 012 stop being shadowed.
--
--   3. HIGH — finance must be able to advance bookings from pending_payment
--      to pending_onboarding. bookings_staff_update was kept at
--      branch_manager + supervision_staff in 012, but the API + UI both
--      surface the transition for finance roles. Add finance_staff and
--      finance_manager.
--
--   4. MEDIUM — the storage bucket INSERT policy in 008 had no role gate;
--      any authenticated user could upload to maintenance-photos via a
--      direct supabase client call. Add a maintenance-tier role guard.
--
-- Production note: this migration depends on 011/012 having been applied
-- (it references the new enum values). Apply 010→013 together if shipping
-- to a project that's still on the pre-expansion baseline.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Trigger: block self-modification of role / is_active
-- ----------------------------------------------------------------------------
-- The admin API at /api/admin/users/[id] already returns `selfModify` 400
-- when the caller targets their own row. This trigger is the database-level
-- backstop against direct-RLS self-promotion.

CREATE OR REPLACE FUNCTION public.prevent_self_role_or_active_change()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() = OLD.id
     AND (NEW.role IS DISTINCT FROM OLD.role
          OR NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
    RAISE EXCEPTION 'cannot_self_modify_role_or_active'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_self_role_or_active ON public.staff_profiles;
CREATE TRIGGER trg_prevent_self_role_or_active
  BEFORE UPDATE OF role, is_active ON public.staff_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_or_active_change();


-- ----------------------------------------------------------------------------
-- 2. Tighten legacy `*_manager_*` policies to require role = 'branch_manager'
-- ----------------------------------------------------------------------------
-- Before this migration, these policies checked only is_assigned_to_building().
-- After: the building-assignment check stands AND the caller must actually be
-- a branch_manager. has_admin_access() (via the *_admin_all policies on these
-- tables) continues to grant super_admin / deputy_general_manager unrestricted
-- access. The new manager-tier roles (maintenance_manager, transportation_
-- manager, finance_manager) drop back to their staff-peer access surface.

-- buildings
DROP POLICY IF EXISTS "buildings_manager_update" ON public.buildings;
CREATE POLICY "buildings_manager_update" ON public.buildings
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(id)
  )
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(id)
  );

-- rooms
DROP POLICY IF EXISTS "rooms_manager_insert" ON public.rooms;
CREATE POLICY "rooms_manager_insert" ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "rooms_manager_update" ON public.rooms;
CREATE POLICY "rooms_manager_update" ON public.rooms
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  )
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "rooms_manager_delete" ON public.rooms;
CREATE POLICY "rooms_manager_delete" ON public.rooms
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

-- residents
DROP POLICY IF EXISTS "residents_manager_select" ON public.residents;
CREATE POLICY "residents_manager_select" ON public.residents
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND EXISTS (
      SELECT 1 FROM public.room_assignments ra
      JOIN public.staff_building_assignments sba ON sba.building_id = ra.building_id
      WHERE ra.resident_id = residents.id AND sba.staff_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "residents_manager_update" ON public.residents;
CREATE POLICY "residents_manager_update" ON public.residents
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND EXISTS (
      SELECT 1 FROM public.room_assignments ra
      JOIN public.staff_building_assignments sba ON sba.building_id = ra.building_id
      WHERE ra.resident_id = residents.id AND sba.staff_id = auth.uid()
    )
  );
-- residents_manager_insert is already role-gated (branch_manager + supervision_staff)
-- and stays as-is.

-- room_assignments
DROP POLICY IF EXISTS "assignments_manager_select" ON public.room_assignments;
CREATE POLICY "assignments_manager_select" ON public.room_assignments
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "assignments_manager_insert" ON public.room_assignments;
CREATE POLICY "assignments_manager_insert" ON public.room_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "assignments_manager_update" ON public.room_assignments;
CREATE POLICY "assignments_manager_update" ON public.room_assignments
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  )
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

-- maintenance_requests — branch_manager keeps building-wide CRUD here.
-- maintenance_staff / maintenance_manager retain their narrower policies
-- from 002 / 012 (staff_select with building, staff_update with assigned_to).
-- supervision_staff retains maintenance_supervision_select / _insert from 002.
DROP POLICY IF EXISTS "maintenance_manager_select" ON public.maintenance_requests;
CREATE POLICY "maintenance_manager_select" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "maintenance_manager_insert" ON public.maintenance_requests;
CREATE POLICY "maintenance_manager_insert" ON public.maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "maintenance_manager_update" ON public.maintenance_requests;
CREATE POLICY "maintenance_manager_update" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "maintenance_manager_delete" ON public.maintenance_requests;
CREATE POLICY "maintenance_manager_delete" ON public.maintenance_requests
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );


-- ----------------------------------------------------------------------------
-- 3. bookings_staff_update: add finance_staff + finance_manager
-- ----------------------------------------------------------------------------
-- Finance receives bookings at status='pending_payment' and advances them
-- to 'pending_onboarding' once payment lands. They need UPDATE access.

DROP POLICY IF EXISTS "bookings_staff_update" ON public.booking_requests;
CREATE POLICY "bookings_staff_update" ON public.booking_requests
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'finance_staff', 'finance_manager')
  );


-- ----------------------------------------------------------------------------
-- 4. maintenance-photos storage INSERT: require maintenance-tier role
-- ----------------------------------------------------------------------------
-- The path-prefix check from 008 stays. We add a role guard so a non-
-- maintenance authenticated user can't bypass the API and upload directly.
-- Public maintenance form uploads continue to work — they go through the
-- API's createAdminClient path (service role bypasses RLS).

DROP POLICY IF EXISTS "Staff can upload maintenance photos (bound to request)" ON storage.objects;
CREATE POLICY "Staff can upload maintenance photos (bound to request)"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'maintenance-photos'
  AND (
    split_part(name, '/', 1) = 'temp'
    OR EXISTS (
      SELECT 1 FROM public.maintenance_requests
      WHERE id::text = split_part(name, '/', 1)
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = auth.uid()
      AND is_active
      AND role IN (
        'super_admin', 'deputy_general_manager',
        'branch_manager', 'maintenance_staff', 'maintenance_manager'
      )
  )
);

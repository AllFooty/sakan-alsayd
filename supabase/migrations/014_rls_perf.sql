-- ============================================================================
-- Migration 014: RLS performance optimizations (no security changes)
-- ============================================================================
-- Three classes of changes, all pure performance — every policy keeps its
-- exact prior semantics. Apply this without redeploying app code.
--
--   1. HELPER FUNCTIONS — wrap auth.uid() in (select auth.uid()) so Postgres
--      lifts the call to an InitPlan instead of evaluating it per row.
--      (Supabase's #1 documented RLS perf footgun.) Functions stay
--      STABLE SECURITY DEFINER, so their results are still cached per
--      statement.
--
--   2. INLINE ROLE LOOKUP REPLACEMENT — every policy that previously did
--          (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) ...
--      becomes
--          public.get_user_role() ...
--      The helper is STABLE so Postgres evaluates it once per statement
--      instead of per row scanned. Adding/removing roles to a list now
--      changes only the policy expression, not the lookup pattern.
--
--   3. SUPPORTING INDEXES — composite indexes that cover the predicates the
--      RLS helpers use, so EXISTS subqueries become index-only seeks.
--
-- Tables touched by data-plane policies in this migration:
--   staff_profiles, staff_building_assignments, buildings, rooms,
--   residents, room_assignments, booking_requests, booking_request_notes,
--   maintenance_requests, maintenance_request_notes, activity_log.
--
-- Storage policies (maintenance-photos bucket) are intentionally left alone
-- for this migration — they fire on uploads/deletes only and aren't on the
-- hot path. Can be revisited if profiling shows them costly.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. SUPPORTING INDEXES
-- ----------------------------------------------------------------------------

-- Covers is_super_admin() and has_admin_access() lookups: matches by id and
-- the WHERE clause filters on (role, is_active) in a single index-only scan.
CREATE INDEX IF NOT EXISTS idx_staff_profiles_id_role_active
  ON public.staff_profiles (id, role, is_active);

-- Covers is_assigned_to_building(p_building_id): the EXISTS lookup becomes
-- a single index seek. (The pre-existing single-column indexes from 001
-- still help other queries; this composite serves the RLS hot path.)
CREATE INDEX IF NOT EXISTS idx_sba_staff_building
  ON public.staff_building_assignments (staff_id, building_id);


-- ----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS — use (select auth.uid()) for InitPlan caching
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.staff_profiles WHERE id = (select auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = (select auth.uid())
      AND role = 'super_admin'
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_admin_access()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = (select auth.uid())
      AND role IN ('super_admin', 'deputy_general_manager')
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_assigned_to_building(p_building_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_building_assignments
    WHERE staff_id = (select auth.uid())
      AND building_id = p_building_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ----------------------------------------------------------------------------
-- 3. POLICY REWRITES — replace inline role subqueries with get_user_role(),
--    wrap bare auth.uid() in (select auth.uid())
-- ----------------------------------------------------------------------------
-- Each block: DROP IF EXISTS then CREATE. Semantics unchanged.

-- --- staff_profiles ---------------------------------------------------------
DROP POLICY IF EXISTS "staff_update_own" ON public.staff_profiles;
CREATE POLICY "staff_update_own" ON public.staff_profiles
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- --- buildings -------------------------------------------------------------
-- buildings_manager_update (last set in 013): role gate + assignment check
DROP POLICY IF EXISTS "buildings_manager_update" ON public.buildings;
CREATE POLICY "buildings_manager_update" ON public.buildings
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(id)
  )
  WITH CHECK (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(id)
  );

-- --- rooms -----------------------------------------------------------------
DROP POLICY IF EXISTS "rooms_manager_insert" ON public.rooms;
CREATE POLICY "rooms_manager_insert" ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "rooms_manager_update" ON public.rooms;
CREATE POLICY "rooms_manager_update" ON public.rooms
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  )
  WITH CHECK (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "rooms_manager_delete" ON public.rooms;
CREATE POLICY "rooms_manager_delete" ON public.rooms
  FOR DELETE TO authenticated
  USING (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

-- --- residents -------------------------------------------------------------
-- residents_manager_select (last set in 013): branch_manager + JOIN check
DROP POLICY IF EXISTS "residents_manager_select" ON public.residents;
CREATE POLICY "residents_manager_select" ON public.residents
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'branch_manager'
    AND EXISTS (
      SELECT 1 FROM public.room_assignments ra
      JOIN public.staff_building_assignments sba ON sba.building_id = ra.building_id
      WHERE ra.resident_id = residents.id
        AND sba.staff_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "residents_manager_update" ON public.residents;
CREATE POLICY "residents_manager_update" ON public.residents
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'branch_manager'
    AND EXISTS (
      SELECT 1 FROM public.room_assignments ra
      JOIN public.staff_building_assignments sba ON sba.building_id = ra.building_id
      WHERE ra.resident_id = residents.id
        AND sba.staff_id = (select auth.uid())
    )
  );

-- residents_manager_insert (last set in 002, never updated): role list
DROP POLICY IF EXISTS "residents_manager_insert" ON public.residents;
CREATE POLICY "residents_manager_insert" ON public.residents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('branch_manager', 'supervision_staff')
  );

-- --- room_assignments ------------------------------------------------------
DROP POLICY IF EXISTS "assignments_manager_select" ON public.room_assignments;
CREATE POLICY "assignments_manager_select" ON public.room_assignments
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "assignments_manager_insert" ON public.room_assignments;
CREATE POLICY "assignments_manager_insert" ON public.room_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "assignments_manager_update" ON public.room_assignments;
CREATE POLICY "assignments_manager_update" ON public.room_assignments
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  )
  WITH CHECK (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

-- --- booking_requests ------------------------------------------------------
-- bookings_staff_select (last set in 012): role list
DROP POLICY IF EXISTS "bookings_staff_select" ON public.booking_requests;
CREATE POLICY "bookings_staff_select" ON public.booking_requests
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN
      ('branch_manager', 'supervision_staff', 'finance_staff', 'finance_manager')
  );

-- bookings_staff_update (last set in 013): finance can advance bookings
DROP POLICY IF EXISTS "bookings_staff_update" ON public.booking_requests;
CREATE POLICY "bookings_staff_update" ON public.booking_requests
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN
      ('branch_manager', 'supervision_staff', 'finance_staff', 'finance_manager')
  );

-- --- booking_request_notes -------------------------------------------------
DROP POLICY IF EXISTS "booking_notes_staff_select" ON public.booking_request_notes;
CREATE POLICY "booking_notes_staff_select" ON public.booking_request_notes
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN
      ('branch_manager', 'supervision_staff', 'finance_staff', 'finance_manager')
  );

DROP POLICY IF EXISTS "booking_notes_staff_insert" ON public.booking_request_notes;
CREATE POLICY "booking_notes_staff_insert" ON public.booking_request_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN
      ('branch_manager', 'supervision_staff', 'finance_staff', 'finance_manager')
  );

-- --- maintenance_requests --------------------------------------------------
-- maintenance_manager_* (last set in 013): branch_manager + assignment check
DROP POLICY IF EXISTS "maintenance_manager_select" ON public.maintenance_requests;
CREATE POLICY "maintenance_manager_select" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "maintenance_manager_insert" ON public.maintenance_requests;
CREATE POLICY "maintenance_manager_insert" ON public.maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "maintenance_manager_update" ON public.maintenance_requests;
CREATE POLICY "maintenance_manager_update" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "maintenance_manager_delete" ON public.maintenance_requests;
CREATE POLICY "maintenance_manager_delete" ON public.maintenance_requests
  FOR DELETE TO authenticated
  USING (
    public.get_user_role() = 'branch_manager'
    AND public.is_assigned_to_building(building_id)
  );

-- maintenance_staff_select (last set in 012): role list + assignment
DROP POLICY IF EXISTS "maintenance_staff_select" ON public.maintenance_requests;
CREATE POLICY "maintenance_staff_select" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('maintenance_staff', 'maintenance_manager')
    AND public.is_assigned_to_building(building_id)
  );

-- maintenance_staff_update (last set in 012): role list + own-assignment
DROP POLICY IF EXISTS "maintenance_staff_update" ON public.maintenance_requests;
CREATE POLICY "maintenance_staff_update" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('maintenance_staff', 'maintenance_manager')
    AND assigned_to = (select auth.uid())
  );

-- maintenance_supervision_select (last set in 002): supervision_staff only
DROP POLICY IF EXISTS "maintenance_supervision_select" ON public.maintenance_requests;
CREATE POLICY "maintenance_supervision_select" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'supervision_staff'
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "maintenance_supervision_insert" ON public.maintenance_requests;
CREATE POLICY "maintenance_supervision_insert" ON public.maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'supervision_staff'
    AND public.is_assigned_to_building(building_id)
  );

-- --- maintenance_request_notes ---------------------------------------------
-- (last set in 012: role list)
DROP POLICY IF EXISTS "maintenance_notes_staff_select" ON public.maintenance_request_notes;
CREATE POLICY "maintenance_notes_staff_select" ON public.maintenance_request_notes
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN
      ('branch_manager', 'supervision_staff', 'maintenance_staff', 'maintenance_manager')
  );

DROP POLICY IF EXISTS "maintenance_notes_staff_insert" ON public.maintenance_request_notes;
CREATE POLICY "maintenance_notes_staff_insert" ON public.maintenance_request_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN
      ('branch_manager', 'supervision_staff', 'maintenance_staff', 'maintenance_manager')
  );

-- --- activity_log ----------------------------------------------------------
-- activity_log_insert: caller must be writing their own row
DROP POLICY IF EXISTS "activity_log_insert" ON public.activity_log;
CREATE POLICY "activity_log_insert" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

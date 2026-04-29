-- ============================================================================
-- Migration 027: Phase 5 review fixes — supervision_staff RLS gap +
-- DB-level over-assignment guards on room_assignments.
-- ============================================================================
--
-- Two fixes:
--
-- 1. RLS gap (BLOCKING). The Phase 5 residents/assignments/contracts APIs
--    gate on `branch_manager` AND `supervision_staff`, but the existing RLS
--    policies (014_rls_perf.sql and the per-RLS-of-013) only allow
--    `branch_manager` on residents.SELECT/UPDATE and on
--    room_assignments.SELECT/INSERT/UPDATE. supervision_staff users were
--    therefore passing API auth but seeing empty lists, getting 404s on
--    detail/PATCH, and hitting silent insert failures on move-in. The
--    contracts helper `can_access_resident_contracts` (026) is
--    SECURITY INVOKER and queries room_assignments transitively, so all
--    contract upload/sign/delete also broke for supervision_staff.
--
--    Fix: broaden the manager_* policies to accept both roles. Building
--    scope (via is_assigned_to_building / room_assignments JOIN) is
--    unchanged; this is just the role list.
--
-- 2. Over-assignment race (BLOCKING). The move-in flow is check-then-insert
--    with no DB constraint, so two concurrent transactions can both pass
--    the JS-level vacancy guard and both insert. Two safety nets:
--
--    (a) UNIQUE partial index on (resident_id) WHERE status='active'.
--        Catches the "one active assignment per resident" rule directly
--        with a 23505. Works regardless of isolation level.
--
--    (b) BEFORE-INSERT/UPDATE trigger that takes a row lock on rooms (FOR
--        UPDATE) and counts existing actives. Serializes concurrent
--        activations into the same room and rejects with 'room_capacity_
--        exceeded' (23514). Necessary because partial unique indexes can't
--        express "≤ capacity" for shared rooms.
-- ============================================================================

-- ----- Part 1: residents RLS — add supervision_staff to SELECT + UPDATE ----

DROP POLICY IF EXISTS "residents_manager_select" ON public.residents;
CREATE POLICY "residents_manager_select" ON public.residents
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('branch_manager', 'supervision_staff')
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
    public.get_user_role() IN ('branch_manager', 'supervision_staff')
    AND EXISTS (
      SELECT 1 FROM public.room_assignments ra
      JOIN public.staff_building_assignments sba ON sba.building_id = ra.building_id
      WHERE ra.resident_id = residents.id
        AND sba.staff_id = (select auth.uid())
    )
  );

-- residents_manager_insert was already role-list 'branch_manager' +
-- 'supervision_staff' since 002. Untouched.

-- ----- Part 2: room_assignments RLS — same broadening on the manager_* set --

DROP POLICY IF EXISTS "assignments_manager_select" ON public.room_assignments;
CREATE POLICY "assignments_manager_select" ON public.room_assignments
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('branch_manager', 'supervision_staff')
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "assignments_manager_insert" ON public.room_assignments;
CREATE POLICY "assignments_manager_insert" ON public.room_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('branch_manager', 'supervision_staff')
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "assignments_manager_update" ON public.room_assignments;
CREATE POLICY "assignments_manager_update" ON public.room_assignments
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('branch_manager', 'supervision_staff')
    AND public.is_assigned_to_building(building_id)
  );

-- ----- Part 3: DB-level guards against over-assignment ----------------------

-- 3a. One active assignment per resident — partial unique index.
-- A resident with status='ended' rows can be re-assigned later; only the
-- 'active' rows need to be unique.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_assignment_per_resident
  ON public.room_assignments (resident_id)
  WHERE status = 'active';

-- 3b. Per-room capacity — trigger with row-lock on rooms.
-- The `FOR UPDATE` on the rooms row serializes concurrent INSERTs/UPDATEs
-- targeting the same room. The trigger only fires when the row lands in
-- 'active' state, so check-out (active → ended) never trips it.
CREATE OR REPLACE FUNCTION public.enforce_room_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity     integer;
  v_mode         text;
  v_active_count integer;
  v_max_active   integer;
BEGIN
  -- Lock the room row to serialize concurrent activations into the same room.
  SELECT capacity, occupancy_mode
    INTO v_capacity, v_mode
    FROM public.rooms
    WHERE id = NEW.room_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_capacity   := GREATEST(COALESCE(v_capacity, 1), 1);
  v_max_active := CASE WHEN v_mode = 'shared' THEN v_capacity ELSE 1 END;

  -- Count existing actives for this room, excluding the row being
  -- inserted/updated (relevant on UPDATE that flips status into 'active').
  SELECT COUNT(*)::int
    INTO v_active_count
    FROM public.room_assignments
    WHERE room_id = NEW.room_id
      AND status = 'active'
      AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_active_count + 1 > v_max_active THEN
    RAISE EXCEPTION 'room_capacity_exceeded'
      USING ERRCODE = 'check_violation',
            DETAIL = format(
              'room=%s active_after=%s max=%s mode=%s',
              NEW.room_id, v_active_count + 1, v_max_active, v_mode
            );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_room_capacity_check ON public.room_assignments;
CREATE TRIGGER trg_room_capacity_check
  BEFORE INSERT OR UPDATE OF status, room_id ON public.room_assignments
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.enforce_room_capacity();

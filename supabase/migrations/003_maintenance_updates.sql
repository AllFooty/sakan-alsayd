-- ============================================================================
-- Migration 003: Maintenance Updates
-- ============================================================================
-- Adds requester contact columns to maintenance_requests (for public submissions)
-- Creates maintenance_request_notes table (for internal staff notes)
-- ============================================================================

-- ============================================================================
-- 1. ADD REQUESTER COLUMNS TO maintenance_requests
-- ============================================================================

ALTER TABLE maintenance_requests
  ADD COLUMN requester_name  TEXT,
  ADD COLUMN requester_phone TEXT,
  ADD COLUMN room_number     TEXT;

-- ============================================================================
-- 2. CREATE maintenance_request_notes TABLE
-- ============================================================================

CREATE TABLE maintenance_request_notes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id  UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  author_id               UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE SET NULL,
  note                    TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_maintenance_request_notes_request_id ON maintenance_request_notes (maintenance_request_id);
CREATE INDEX idx_maintenance_request_notes_created_at ON maintenance_request_notes (created_at DESC);

-- ============================================================================
-- 3. RLS FOR maintenance_request_notes
-- ============================================================================

ALTER TABLE public.maintenance_request_notes ENABLE ROW LEVEL SECURITY;

-- Super admin: full access
CREATE POLICY "maintenance_notes_admin_all" ON public.maintenance_request_notes
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Staff: select (branch_manager, supervision_staff, maintenance_staff)
CREATE POLICY "maintenance_notes_staff_select" ON public.maintenance_request_notes
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'maintenance_staff')
  );

-- Staff: insert (branch_manager, supervision_staff, maintenance_staff)
CREATE POLICY "maintenance_notes_staff_insert" ON public.maintenance_request_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'maintenance_staff')
  );

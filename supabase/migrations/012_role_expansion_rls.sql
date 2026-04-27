-- ============================================================================
-- Migration 012: Role expansion — RLS updates for new roles
-- ============================================================================
-- Mirrors the access of department-manager roles to their staff counterpart,
-- and grants deputy_general_manager super_admin-equivalent access to every
-- table EXCEPT staff_profiles (user management remains super_admin only).
--
-- Strategy:
--   1. New helper has_admin_access() = role IN ('super_admin','deputy_general_manager')
--   2. Replace each existing `*_admin_all` policy that was using is_super_admin()
--      with one that uses has_admin_access(), EXCEPT for staff_profiles policies.
--   3. Extend role-list policies (e.g. bookings_staff_select) to include the
--      manager peer of each staff role they reference.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper: has_admin_access() — super_admin OR deputy_general_manager
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_admin_access()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'deputy_general_manager')
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 2. Replace `*_admin_all` policies on non-staff-profile tables
--    (staff_profiles user-management policies stay restricted to super_admin)
-- ----------------------------------------------------------------------------

-- staff_building_assignments
DROP POLICY IF EXISTS "sba_admin_all" ON public.staff_building_assignments;
CREATE POLICY "sba_admin_all" ON public.staff_building_assignments
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- buildings
DROP POLICY IF EXISTS "buildings_admin_all" ON public.buildings;
CREATE POLICY "buildings_admin_all" ON public.buildings
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- rooms
DROP POLICY IF EXISTS "rooms_admin_all" ON public.rooms;
CREATE POLICY "rooms_admin_all" ON public.rooms
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- residents
DROP POLICY IF EXISTS "residents_admin_all" ON public.residents;
CREATE POLICY "residents_admin_all" ON public.residents
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- room_assignments
DROP POLICY IF EXISTS "assignments_admin_all" ON public.room_assignments;
CREATE POLICY "assignments_admin_all" ON public.room_assignments
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- booking_requests
DROP POLICY IF EXISTS "bookings_admin_all" ON public.booking_requests;
CREATE POLICY "bookings_admin_all" ON public.booking_requests
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- booking_request_notes
DROP POLICY IF EXISTS "booking_notes_admin_all" ON public.booking_request_notes;
CREATE POLICY "booking_notes_admin_all" ON public.booking_request_notes
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- maintenance_requests
DROP POLICY IF EXISTS "maintenance_admin_all" ON public.maintenance_requests;
CREATE POLICY "maintenance_admin_all" ON public.maintenance_requests
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- maintenance_request_notes
DROP POLICY IF EXISTS "maintenance_notes_admin_all" ON public.maintenance_request_notes;
CREATE POLICY "maintenance_notes_admin_all" ON public.maintenance_request_notes
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- cms_services
DROP POLICY IF EXISTS "cms_services_admin_all" ON public.cms_services;
CREATE POLICY "cms_services_admin_all" ON public.cms_services
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- cms_testimonials
DROP POLICY IF EXISTS "cms_testimonials_admin_all" ON public.cms_testimonials;
CREATE POLICY "cms_testimonials_admin_all" ON public.cms_testimonials
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- cms_faq
DROP POLICY IF EXISTS "cms_faq_admin_all" ON public.cms_faq;
CREATE POLICY "cms_faq_admin_all" ON public.cms_faq
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- cms_contacts
DROP POLICY IF EXISTS "cms_contacts_admin_all" ON public.cms_contacts;
CREATE POLICY "cms_contacts_admin_all" ON public.cms_contacts
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- site_config
DROP POLICY IF EXISTS "site_config_admin_all" ON public.site_config;
CREATE POLICY "site_config_admin_all" ON public.site_config
  FOR ALL TO authenticated
  USING (public.has_admin_access())
  WITH CHECK (public.has_admin_access());

-- activity_log
DROP POLICY IF EXISTS "activity_log_admin_select" ON public.activity_log;
CREATE POLICY "activity_log_admin_select" ON public.activity_log
  FOR SELECT TO authenticated
  USING (public.has_admin_access());

-- ----------------------------------------------------------------------------
-- 3. Extend role-list policies to include manager peers of staff roles
-- ----------------------------------------------------------------------------

-- booking_requests: finance_staff + finance_manager peer access
DROP POLICY IF EXISTS "bookings_staff_select" ON public.booking_requests;
CREATE POLICY "bookings_staff_select" ON public.booking_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'finance_staff', 'finance_manager')
  );

-- (bookings_staff_update keeps the same role list — finance_staff was not in it)

-- booking_request_notes: add finance_manager
DROP POLICY IF EXISTS "booking_notes_staff_select" ON public.booking_request_notes;
CREATE POLICY "booking_notes_staff_select" ON public.booking_request_notes
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'finance_staff', 'finance_manager')
  );

DROP POLICY IF EXISTS "booking_notes_staff_insert" ON public.booking_request_notes;
CREATE POLICY "booking_notes_staff_insert" ON public.booking_request_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'finance_staff', 'finance_manager')
  );

-- maintenance_requests: add maintenance_manager peer
DROP POLICY IF EXISTS "maintenance_staff_select" ON public.maintenance_requests;
CREATE POLICY "maintenance_staff_select" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('maintenance_staff', 'maintenance_manager')
    AND public.is_assigned_to_building(building_id)
  );

DROP POLICY IF EXISTS "maintenance_staff_update" ON public.maintenance_requests;
CREATE POLICY "maintenance_staff_update" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('maintenance_staff', 'maintenance_manager')
    AND assigned_to = auth.uid()
  );

-- maintenance_request_notes: add maintenance_manager
DROP POLICY IF EXISTS "maintenance_notes_staff_select" ON public.maintenance_request_notes;
CREATE POLICY "maintenance_notes_staff_select" ON public.maintenance_request_notes
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'maintenance_staff', 'maintenance_manager')
  );

DROP POLICY IF EXISTS "maintenance_notes_staff_insert" ON public.maintenance_request_notes;
CREATE POLICY "maintenance_notes_staff_insert" ON public.maintenance_request_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'maintenance_staff', 'maintenance_manager')
  );

-- ----------------------------------------------------------------------------
-- 4. maintenance-photos storage bucket: include maintenance_manager + deputy
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Privileged staff can delete maintenance photos" ON storage.objects;
CREATE POLICY "Privileged staff can delete maintenance photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'maintenance-photos'
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

DROP POLICY IF EXISTS "Privileged staff can update maintenance photos" ON storage.objects;
CREATE POLICY "Privileged staff can update maintenance photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'maintenance-photos'
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

-- ============================================================================
-- Sakan Alsayd Platform - Row Level Security Policies
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.staff_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_assigned_to_building(p_building_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_building_assignments
    WHERE staff_id = auth.uid() AND building_id = p_building_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_building_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_request_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STAFF_PROFILES
-- ============================================================================

CREATE POLICY "staff_select_all" ON public.staff_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "staff_update_own" ON public.staff_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "staff_admin_insert" ON public.staff_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "staff_admin_update" ON public.staff_profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "staff_admin_delete" ON public.staff_profiles
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ============================================================================
-- STAFF_BUILDING_ASSIGNMENTS
-- ============================================================================

CREATE POLICY "sba_select_all" ON public.staff_building_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sba_admin_all" ON public.staff_building_assignments
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- BUILDINGS
-- ============================================================================

CREATE POLICY "buildings_auth_select" ON public.buildings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "buildings_anon_select" ON public.buildings
  FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "buildings_admin_all" ON public.buildings
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "buildings_manager_update" ON public.buildings
  FOR UPDATE TO authenticated
  USING (public.is_assigned_to_building(id))
  WITH CHECK (public.is_assigned_to_building(id));

-- ============================================================================
-- ROOMS
-- ============================================================================

CREATE POLICY "rooms_auth_select" ON public.rooms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rooms_anon_select" ON public.rooms
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.buildings b WHERE b.id = building_id AND b.is_active = true));

CREATE POLICY "rooms_admin_all" ON public.rooms
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "rooms_manager_insert" ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (public.is_assigned_to_building(building_id));

CREATE POLICY "rooms_manager_update" ON public.rooms
  FOR UPDATE TO authenticated
  USING (public.is_assigned_to_building(building_id))
  WITH CHECK (public.is_assigned_to_building(building_id));

CREATE POLICY "rooms_manager_delete" ON public.rooms
  FOR DELETE TO authenticated
  USING (public.is_assigned_to_building(building_id));

-- ============================================================================
-- RESIDENTS
-- ============================================================================

CREATE POLICY "residents_admin_all" ON public.residents
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "residents_manager_select" ON public.residents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_assignments ra
      JOIN public.staff_building_assignments sba ON sba.building_id = ra.building_id
      WHERE ra.resident_id = residents.id AND sba.staff_id = auth.uid()
    )
  );

CREATE POLICY "residents_manager_insert" ON public.residents
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN ('branch_manager', 'supervision_staff')
  );

CREATE POLICY "residents_manager_update" ON public.residents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.room_assignments ra
      JOIN public.staff_building_assignments sba ON sba.building_id = ra.building_id
      WHERE ra.resident_id = residents.id AND sba.staff_id = auth.uid()
    )
  );

-- ============================================================================
-- ROOM_ASSIGNMENTS
-- ============================================================================

CREATE POLICY "assignments_admin_all" ON public.room_assignments
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "assignments_manager_select" ON public.room_assignments
  FOR SELECT TO authenticated
  USING (public.is_assigned_to_building(building_id));

CREATE POLICY "assignments_manager_insert" ON public.room_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_assigned_to_building(building_id));

CREATE POLICY "assignments_manager_update" ON public.room_assignments
  FOR UPDATE TO authenticated
  USING (public.is_assigned_to_building(building_id))
  WITH CHECK (public.is_assigned_to_building(building_id));

-- ============================================================================
-- BOOKING_REQUESTS
-- ============================================================================

-- Anonymous can insert (website contact form)
CREATE POLICY "bookings_anon_insert" ON public.booking_requests
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "bookings_auth_insert" ON public.booking_requests
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "bookings_admin_all" ON public.booking_requests
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "bookings_staff_select" ON public.booking_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'finance_staff')
  );

CREATE POLICY "bookings_staff_update" ON public.booking_requests
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff')
  );

-- ============================================================================
-- BOOKING_REQUEST_NOTES
-- ============================================================================

CREATE POLICY "booking_notes_admin_all" ON public.booking_request_notes
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "booking_notes_staff_select" ON public.booking_request_notes
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'finance_staff')
  );

CREATE POLICY "booking_notes_staff_insert" ON public.booking_request_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'finance_staff')
  );

-- ============================================================================
-- MAINTENANCE_REQUESTS
-- ============================================================================

CREATE POLICY "maintenance_admin_all" ON public.maintenance_requests
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "maintenance_manager_select" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (public.is_assigned_to_building(building_id));

CREATE POLICY "maintenance_manager_insert" ON public.maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.is_assigned_to_building(building_id));

CREATE POLICY "maintenance_manager_update" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (public.is_assigned_to_building(building_id));

CREATE POLICY "maintenance_manager_delete" ON public.maintenance_requests
  FOR DELETE TO authenticated
  USING (public.is_assigned_to_building(building_id));

CREATE POLICY "maintenance_staff_select" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'maintenance_staff'
    AND public.is_assigned_to_building(building_id)
  );

CREATE POLICY "maintenance_staff_update" ON public.maintenance_requests
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'maintenance_staff'
    AND assigned_to = auth.uid()
  );

CREATE POLICY "maintenance_supervision_select" ON public.maintenance_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'supervision_staff'
    AND public.is_assigned_to_building(building_id)
  );

CREATE POLICY "maintenance_supervision_insert" ON public.maintenance_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) = 'supervision_staff'
    AND public.is_assigned_to_building(building_id)
  );

-- ============================================================================
-- CMS TABLES (public read for website, admin write)
-- ============================================================================

-- cms_services
CREATE POLICY "cms_services_anon_select" ON public.cms_services
  FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "cms_services_auth_select" ON public.cms_services
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cms_services_admin_all" ON public.cms_services
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- cms_testimonials
CREATE POLICY "cms_testimonials_anon_select" ON public.cms_testimonials
  FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "cms_testimonials_auth_select" ON public.cms_testimonials
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cms_testimonials_admin_all" ON public.cms_testimonials
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- cms_faq
CREATE POLICY "cms_faq_anon_select" ON public.cms_faq
  FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "cms_faq_auth_select" ON public.cms_faq
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cms_faq_admin_all" ON public.cms_faq
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- cms_contacts
CREATE POLICY "cms_contacts_anon_select" ON public.cms_contacts
  FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "cms_contacts_auth_select" ON public.cms_contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cms_contacts_admin_all" ON public.cms_contacts
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- site_config
CREATE POLICY "site_config_anon_select" ON public.site_config
  FOR SELECT TO anon USING (true);
CREATE POLICY "site_config_auth_select" ON public.site_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "site_config_admin_all" ON public.site_config
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ============================================================================
-- ACTIVITY_LOG (append-only)
-- ============================================================================

CREATE POLICY "activity_log_admin_select" ON public.activity_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "activity_log_insert" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Sakan Alsayd Platform - Database Schema Migration
-- ============================================================================
-- This migration creates the complete database schema including:
--   - 12 custom enum types
--   - 15 tables with full constraints and relationships
--   - updated_at trigger function applied to all mutable tables
--   - Indexes for common query patterns
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'branch_manager',
  'maintenance_staff',
  'transportation_staff',
  'supervision_staff',
  'finance_staff'
);

CREATE TYPE room_type AS ENUM (
  'single',
  'double',
  'triple',
  'suite'
);

CREATE TYPE bathroom_type AS ENUM (
  'shared',
  'shared-a',
  'shared-b',
  'shared-balcony',
  'private',
  'private-balcony',
  'private-two-rooms',
  'master',
  'master-a',
  'master-b',
  'master-balcony',
  'suite'
);

CREATE TYPE room_status AS ENUM (
  'available',
  'occupied',
  'maintenance',
  'reserved'
);

CREATE TYPE resident_status AS ENUM (
  'active',
  'checked_out',
  'suspended'
);

CREATE TYPE assignment_status AS ENUM (
  'active',
  'ended'
);

CREATE TYPE booking_status AS ENUM (
  'new',
  'contacted',
  'confirmed',
  'rejected'
);

CREATE TYPE maintenance_category AS ENUM (
  'plumbing',
  'electrical',
  'furniture',
  'cleaning',
  'hvac',
  'general'
);

CREATE TYPE maintenance_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

CREATE TYPE maintenance_status AS ENUM (
  'submitted',
  'assigned',
  'in_progress',
  'completed',
  'cancelled'
);

CREATE TYPE testimonial_type AS ENUM (
  'quote',
  'screenshot',
  'video'
);

CREATE TYPE screenshot_source AS ENUM (
  'google_maps',
  'twitter',
  'instagram',
  'whatsapp',
  'other'
);

-- ============================================================================
-- TRIGGER FUNCTION: auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE 1: staff_profiles
-- ============================================================================

CREATE TABLE staff_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role        user_role NOT NULL DEFAULT 'supervision_staff',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_staff_profiles_updated_at
  BEFORE UPDATE ON staff_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 2: buildings
-- ============================================================================

CREATE TABLE buildings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT UNIQUE NOT NULL,
  city_en          TEXT NOT NULL,
  city_ar          TEXT NOT NULL,
  neighborhood_en  TEXT NOT NULL,
  neighborhood_ar  TEXT NOT NULL,
  description_en   TEXT NOT NULL DEFAULT '',
  description_ar   TEXT NOT NULL DEFAULT '',
  cover_image      TEXT,
  images           TEXT[] DEFAULT '{}',
  map_url          TEXT,
  landmarks        JSONB NOT NULL DEFAULT '[]',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  is_placeholder   BOOLEAN NOT NULL DEFAULT false,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_buildings_updated_at
  BEFORE UPDATE ON buildings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 3: staff_building_assignments
-- ============================================================================

CREATE TABLE staff_building_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  building_id  UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, building_id)
);

-- ============================================================================
-- TABLE 4: rooms
-- ============================================================================

CREATE TABLE rooms (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id      UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  room_number      TEXT,
  floor            INTEGER,
  room_type        room_type NOT NULL,
  bathroom_type    bathroom_type NOT NULL,
  monthly_price    NUMERIC(10,2) NOT NULL,
  discounted_price NUMERIC(10,2),
  status           room_status NOT NULL DEFAULT 'available',
  images           TEXT[] DEFAULT '{}',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 5: residents
-- ============================================================================

CREATE TABLE residents (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name                TEXT NOT NULL,
  phone                    TEXT NOT NULL,
  email                    TEXT,
  national_id_or_iqama     TEXT,
  nationality              TEXT,
  university_or_workplace  TEXT,
  emergency_contact_name   TEXT,
  emergency_contact_phone  TEXT,
  profile_image            TEXT,
  documents                TEXT[] DEFAULT '{}',
  status                   resident_status NOT NULL DEFAULT 'active',
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_residents_updated_at
  BEFORE UPDATE ON residents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 6: room_assignments
-- ============================================================================

CREATE TABLE room_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id     UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  room_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  building_id     UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  check_in_date   DATE NOT NULL,
  check_out_date  DATE,
  status          assignment_status NOT NULL DEFAULT 'active',
  created_by      UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_room_assignments_updated_at
  BEFORE UPDATE ON room_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 7: booking_requests
-- ============================================================================

CREATE TABLE booking_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT NOT NULL,
  city_interested  TEXT NOT NULL,
  message          TEXT,
  status           booking_status NOT NULL DEFAULT 'new',
  assigned_to      UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_booking_requests_updated_at
  BEFORE UPDATE ON booking_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 8: booking_request_notes
-- ============================================================================

CREATE TABLE booking_request_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id  UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  author_id           UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE SET NULL,
  note                TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- TABLE 9: maintenance_requests
-- ============================================================================

CREATE TABLE maintenance_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id       UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  room_id           UUID REFERENCES rooms(id) ON DELETE SET NULL,
  resident_id       UUID REFERENCES residents(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  category          maintenance_category NOT NULL DEFAULT 'general',
  priority          maintenance_priority NOT NULL DEFAULT 'medium',
  status            maintenance_status NOT NULL DEFAULT 'submitted',
  assigned_to       UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  photos            TEXT[] DEFAULT '{}',
  resolution_notes  TEXT,
  created_by        UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE TRIGGER trg_maintenance_requests_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 10: cms_services
-- ============================================================================

CREATE TABLE cms_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon_name       TEXT NOT NULL,
  title_ar        TEXT NOT NULL,
  title_en        TEXT NOT NULL,
  description_ar  TEXT NOT NULL,
  description_en  TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_cms_services_updated_at
  BEFORE UPDATE ON cms_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 11: cms_testimonials
-- ============================================================================

CREATE TABLE cms_testimonials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type             testimonial_type NOT NULL,
  name             TEXT,
  name_ar          TEXT,
  building         TEXT,
  building_ar      TEXT,
  city             TEXT,
  city_ar          TEXT,
  quote_en         TEXT,
  quote_ar         TEXT,
  rating           INTEGER CHECK (rating >= 1 AND rating <= 5),
  avatar_url       TEXT,
  source           screenshot_source,
  source_label     TEXT,
  source_label_ar  TEXT,
  screenshot_url   TEXT,
  alt_text         TEXT,
  alt_text_ar      TEXT,
  video_title      TEXT,
  video_title_ar   TEXT,
  thumbnail_url    TEXT,
  youtube_id       TEXT,
  duration         TEXT,
  is_featured      BOOLEAN NOT NULL DEFAULT false,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_cms_testimonials_updated_at
  BEFORE UPDATE ON cms_testimonials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 12: cms_faq
-- ============================================================================

CREATE TABLE cms_faq (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_ar  TEXT NOT NULL,
  question_en  TEXT NOT NULL,
  answer_ar    TEXT NOT NULL,
  answer_en    TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_cms_faq_updated_at
  BEFORE UPDATE ON cms_faq
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 13: cms_contacts
-- ============================================================================

CREATE TABLE cms_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_en     TEXT NOT NULL,
  type_ar     TEXT NOT NULL,
  phone       TEXT NOT NULL,
  whatsapp    TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_cms_contacts_updated_at
  BEFORE UPDATE ON cms_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 14: site_config
-- ============================================================================

CREATE TABLE site_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_site_config_updated_at
  BEFORE UPDATE ON site_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 15: activity_log
-- ============================================================================

CREATE TABLE activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID,
  details      JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- staff_profiles
CREATE INDEX idx_staff_profiles_role      ON staff_profiles (role);
CREATE INDEX idx_staff_profiles_is_active ON staff_profiles (is_active);

-- buildings
CREATE INDEX idx_buildings_slug       ON buildings (slug);
CREATE INDEX idx_buildings_city_en    ON buildings (city_en);
CREATE INDEX idx_buildings_is_active  ON buildings (is_active);
CREATE INDEX idx_buildings_sort_order ON buildings (sort_order);

-- rooms
CREATE INDEX idx_rooms_building_id            ON rooms (building_id);
CREATE INDEX idx_rooms_status                 ON rooms (status);
CREATE INDEX idx_rooms_room_type              ON rooms (room_type);
CREATE INDEX idx_rooms_building_id_status     ON rooms (building_id, status);
CREATE INDEX idx_rooms_building_id_room_type  ON rooms (building_id, room_type);

-- residents
CREATE INDEX idx_residents_status               ON residents (status);
CREATE INDEX idx_residents_phone                ON residents (phone);
CREATE INDEX idx_residents_national_id_or_iqama ON residents (national_id_or_iqama);
CREATE INDEX idx_residents_full_name            ON residents (full_name);

-- room_assignments
CREATE INDEX idx_room_assignments_resident_id    ON room_assignments (resident_id);
CREATE INDEX idx_room_assignments_room_id        ON room_assignments (room_id);
CREATE INDEX idx_room_assignments_building_id    ON room_assignments (building_id);
CREATE INDEX idx_room_assignments_status         ON room_assignments (status);
CREATE INDEX idx_room_assignments_bldg_active    ON room_assignments (building_id, status) WHERE status = 'active';
CREATE INDEX idx_room_assignments_dates          ON room_assignments (check_in_date, check_out_date);

-- booking_requests
CREATE INDEX idx_booking_requests_status          ON booking_requests (status);
CREATE INDEX idx_booking_requests_assigned_to     ON booking_requests (assigned_to);
CREATE INDEX idx_booking_requests_created_at      ON booking_requests (created_at DESC);
CREATE INDEX idx_booking_requests_city_interested ON booking_requests (city_interested);

-- booking_request_notes
CREATE INDEX idx_booking_request_notes_request_id  ON booking_request_notes (booking_request_id);
CREATE INDEX idx_booking_request_notes_created_at  ON booking_request_notes (created_at DESC);

-- maintenance_requests
CREATE INDEX idx_maintenance_requests_building_id       ON maintenance_requests (building_id);
CREATE INDEX idx_maintenance_requests_room_id           ON maintenance_requests (room_id);
CREATE INDEX idx_maintenance_requests_resident_id       ON maintenance_requests (resident_id);
CREATE INDEX idx_maintenance_requests_status            ON maintenance_requests (status);
CREATE INDEX idx_maintenance_requests_priority          ON maintenance_requests (priority);
CREATE INDEX idx_maintenance_requests_assigned_to       ON maintenance_requests (assigned_to);
CREATE INDEX idx_maintenance_requests_category          ON maintenance_requests (category);
CREATE INDEX idx_maintenance_requests_bldg_status       ON maintenance_requests (building_id, status);
CREATE INDEX idx_maintenance_requests_created_at        ON maintenance_requests (created_at DESC);

-- cms_services
CREATE INDEX idx_cms_services_sort_active ON cms_services (sort_order) WHERE is_active = true;

-- cms_testimonials
CREATE INDEX idx_cms_testimonials_sort_active  ON cms_testimonials (sort_order) WHERE is_active = true;
CREATE INDEX idx_cms_testimonials_type         ON cms_testimonials (type);
CREATE INDEX idx_cms_testimonials_featured     ON cms_testimonials (is_featured) WHERE is_featured = true;

-- cms_faq
CREATE INDEX idx_cms_faq_sort_active ON cms_faq (sort_order) WHERE is_active = true;

-- cms_contacts
CREATE INDEX idx_cms_contacts_sort_active ON cms_contacts (sort_order) WHERE is_active = true;

-- activity_log
CREATE INDEX idx_activity_log_user_id     ON activity_log (user_id);
CREATE INDEX idx_activity_log_entity      ON activity_log (entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at  ON activity_log (created_at DESC);
CREATE INDEX idx_activity_log_action      ON activity_log (action);

-- staff_building_assignments
CREATE INDEX idx_staff_building_assignments_staff_id    ON staff_building_assignments (staff_id);
CREATE INDEX idx_staff_building_assignments_building_id ON staff_building_assignments (building_id);
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
-- ============================================================================
-- Sakan Alsayd Platform - Seed Data
-- ============================================================================
-- Inserts all buildings and room types from the existing locations.ts file.
-- Buildings use deterministic UUIDs so rooms can reference them.
-- ============================================================================

-- ============================================================================
-- BUILDINGS
-- ============================================================================

INSERT INTO buildings (id, slug, city_en, city_ar, neighborhood_en, neighborhood_ar, description_en, description_ar, cover_image, map_url, landmarks, is_active, is_placeholder, sort_order)
VALUES
  -- 1. Khobar - Al-Olaya
  (
    '00000000-0000-0000-0000-000000000001',
    'khobar-alolaya',
    'Khobar', E'\u0627\u0644\u062E\u0628\u0631',
    'Al-Olaya', E'\u0627\u0644\u0639\u0644\u064A\u0627',
    'Located in Al-Olaya, the most vibrant neighborhood in Khobar. Walking distance to restaurants, cafes, laundries, and all services.',
    E'\u062D\u064A \u0627\u0644\u0639\u0644\u064A\u0627 - \u0623\u0643\u062B\u0631 \u0623\u062D\u064A\u0627\u0621 \u0627\u0644\u062E\u0628\u0631 \u062D\u064A\u0648\u064A\u0629. \u0639\u0644\u0649 \u0645\u0633\u0627\u0641\u0629 \u0645\u0634\u064A \u0645\u0646 \u0627\u0644\u0645\u0637\u0627\u0639\u0645 \u0648\u0627\u0644\u0643\u0627\u0641\u064A\u0647\u0627\u062A \u0648\u0627\u0644\u0645\u063A\u0627\u0633\u0644 \u0648\u062C\u0645\u064A\u0639 \u0627\u0644\u062E\u062F\u0645\u0627\u062A.',
    NULL,
    'https://maps.app.goo.gl/xEkYrLEVorwnsLzP6?g_st=ic',
    '[{"name_en": "Restaurants & Cafes", "name_ar": "\u0645\u0637\u0627\u0639\u0645 \u0648\u0643\u0627\u0641\u064A\u0647\u0627\u062A", "distance_en": "Walking distance", "distance_ar": "\u0645\u0633\u0627\u0641\u0629 \u0645\u0634\u064A"}, {"name_en": "Services & Shopping", "name_ar": "\u062E\u062F\u0645\u0627\u062A \u0648\u062A\u0633\u0648\u0642", "distance_en": "Walking distance", "distance_ar": "\u0645\u0633\u0627\u0641\u0629 \u0645\u0634\u064A"}]'::jsonb,
    true, false, 1
  ),

  -- 2. Khobar - Al-Andalus
  (
    '00000000-0000-0000-0000-000000000002',
    'khobar-alandalus',
    'Khobar', E'\u0627\u0644\u062E\u0628\u0631',
    'Al-Andalus', E'\u0627\u0644\u0623\u0646\u062F\u0644\u0633',
    'Located in Al-Andalus, Khobar. 10-15 min to IAU, 3 min to Villagio, near hospitals. Features pool, sauna, gym, and waiting reception.',
    E'\u062D\u064A \u0627\u0644\u0623\u0646\u062F\u0644\u0633 \u0628\u0627\u0644\u062E\u0628\u0631 - 10-15 \u062F\u0642\u064A\u0642\u0629 \u0645\u0646 \u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646\u060C 3 \u062F\u0642\u0627\u0626\u0642 \u0645\u0646 \u0641\u064A\u0644\u0627\u062C\u064A\u0648\u060C \u0642\u0631\u064A\u0628 \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u0634\u0641\u064A\u0627\u062A. \u064A\u062A\u0645\u064A\u0632 \u0628\u0645\u0633\u0628\u062D \u0648\u0633\u0627\u0648\u0646\u0627 \u0648\u0635\u0627\u0644\u0629 \u0631\u064A\u0627\u0636\u064A\u0629 \u0648\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0646\u062A\u0638\u0627\u0631.',
    NULL,
    'https://maps.app.goo.gl/odAYEoTAmu4ha8oe9?g_st=ic',
    '[{"name_en": "IAU Rakah", "name_ar": "\u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 - \u0627\u0644\u0631\u0627\u0643\u0629", "distance_en": "10-15 minutes", "distance_ar": "10-15 \u062F\u0642\u064A\u0642\u0629"}, {"name_en": "Villagio", "name_ar": "\u0641\u064A\u0644\u0627\u062C\u064A\u0648", "distance_en": "3 minutes", "distance_ar": "3 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "King Fahd Hospital", "name_ar": "\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0645\u0644\u0643 \u0641\u0647\u062F", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}, {"name_en": "Al-Mana Hospital", "name_ar": "\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0645\u0627\u0646\u0639", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}, {"name_en": "Sulaiman Al-Habib", "name_ar": "\u0633\u0644\u064A\u0645\u0627\u0646 \u0627\u0644\u062D\u0628\u064A\u0628", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}]'::jsonb,
    true, false, 2
  ),

  -- 3. Khobar - Al-Rakah
  (
    '00000000-0000-0000-0000-000000000003',
    'khobar-alrakah',
    'Khobar', E'\u0627\u0644\u062E\u0628\u0631',
    'Al-Rakah', E'\u0645\u062C\u0645\u0639 \u0627\u0644\u0631\u0627\u0643\u0629 \u0627\u0644\u0633\u0643\u0646\u064A',
    'Located in Al-Rakah, Khobar. 3 min to IAU, 3 min to Al-Mana College, 10 min to Al-Yamamah University. Quiet residential neighborhood.',
    E'\u062D\u064A \u0627\u0644\u0631\u0627\u0643\u0629 \u0628\u0627\u0644\u062E\u0628\u0631 - 3 \u062F\u0642\u0627\u0626\u0642 \u0645\u0646 \u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646\u060C 3 \u062F\u0642\u0627\u0626\u0642 \u0645\u0646 \u0643\u0644\u064A\u0629 \u0627\u0644\u0645\u0627\u0646\u0639\u060C 10 \u062F\u0642\u0627\u0626\u0642 \u0645\u0646 \u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u064A\u0645\u0627\u0645\u0629. \u062D\u064A \u0633\u0643\u0646\u064A \u0647\u0627\u062F\u0626.',
    NULL,
    'https://maps.app.goo.gl/Vis5Dq8qaAwiQx4A8?g_st=ic',
    '[{"name_en": "IAU", "name_ar": "\u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646", "distance_en": "3 minutes", "distance_ar": "3 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Al-Mana College", "name_ar": "\u0643\u0644\u064A\u0629 \u0627\u0644\u0645\u0627\u0646\u0639", "distance_en": "3 minutes", "distance_ar": "3 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Al-Yamamah University", "name_ar": "\u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u064A\u0645\u0627\u0645\u0629", "distance_en": "10 minutes", "distance_ar": "10 \u062F\u0642\u0627\u0626\u0642"}]'::jsonb,
    true, false, 3
  ),

  -- 4. Dammam - Al-Safa (slug: dammam-alaziziah)
  (
    '00000000-0000-0000-0000-000000000004',
    'dammam-alaziziah',
    'Dammam', E'\u0627\u0644\u062F\u0645\u0627\u0645',
    'Al-Safa', E'\u0627\u0644\u0635\u0641\u0627',
    'Located in Al-Safa district, Dammam. 10 min walk to Dareen Mall. Near IAU Rayyan, Al-Ghad College, and Dammam Central Hospital.',
    E'\u062D\u064A \u0627\u0644\u0635\u0641\u0627 \u0628\u0627\u0644\u062F\u0645\u0627\u0645 - 10 \u062F\u0642\u0627\u0626\u0642 \u0645\u0634\u064A \u0625\u0644\u0649 \u062F\u0627\u0631\u064A\u0646 \u0645\u0648\u0644. \u0642\u0631\u064A\u0628 \u0645\u0646 \u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 \u0641\u0631\u0639 \u0627\u0644\u0631\u064A\u0627\u0646 \u0648\u0643\u0644\u064A\u0629 \u0627\u0644\u063A\u062F \u0648\u0627\u0644\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0628\u0627\u0644\u062F\u0645\u0627\u0645.',
    NULL,
    'https://maps.app.goo.gl/BzvKVyG8oigUbHr87?g_st=ic',
    '[{"name_en": "Dareen Mall", "name_ar": "\u062F\u0627\u0631\u064A\u0646 \u0645\u0648\u0644", "distance_en": "10 min walk", "distance_ar": "10 \u062F\u0642\u0627\u0626\u0642 \u0645\u0634\u064A"}, {"name_en": "IAU Rayyan", "name_ar": "\u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 - \u0627\u0644\u0631\u064A\u0627\u0646", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}, {"name_en": "Al-Ghad College", "name_ar": "\u0643\u0644\u064A\u0629 \u0627\u0644\u063A\u062F", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}, {"name_en": "Dammam Central Hospital", "name_ar": "\u0627\u0644\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0628\u0627\u0644\u062F\u0645\u0627\u0645", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}, {"name_en": "Al-Asala & Batterjee", "name_ar": "\u0627\u0644\u0623\u0635\u0627\u0644\u0629 \u0648\u0628\u062A\u0631\u062C\u064A", "distance_en": "17 minutes", "distance_ar": "17 \u062F\u0642\u064A\u0642\u0629"}]'::jsonb,
    true, false, 4
  ),

  -- 5. Jubail - Jalmudah
  (
    '00000000-0000-0000-0000-000000000005',
    'jubail-jalmudah',
    'Jubail', E'\u0627\u0644\u062C\u0628\u064A\u0644 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629',
    'Jalmudah', E'\u062C\u0644\u0645\u0648\u062F\u0629',
    'Located in Jalmudah district, Jubail. 5 min walk to grocery center. Serves nearby colleges and hospitals.',
    E'\u062D\u064A \u062C\u0644\u0645\u0648\u062F\u0629 \u0628\u0627\u0644\u062C\u0628\u064A\u0644 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629 - 5 \u062F\u0642\u0627\u0626\u0642 \u0645\u0634\u064A \u0625\u0644\u0649 \u0645\u0631\u0643\u0632 \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u0627\u062A. \u064A\u062E\u062F\u0645 \u0627\u0644\u0643\u0644\u064A\u0627\u062A \u0648\u0627\u0644\u0645\u0633\u062A\u0634\u0641\u064A\u0627\u062A \u0627\u0644\u0642\u0631\u064A\u0628\u0629.',
    NULL,
    'https://maps.app.goo.gl/3W6RL75MdUuXzAfn8?g_st=ic',
    '[{"name_en": "Grocery Center", "name_ar": "\u0645\u0631\u0643\u0632 \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u0627\u062A", "distance_en": "5 min walk", "distance_ar": "5 \u062F\u0642\u0627\u0626\u0642 \u0645\u0634\u064A"}, {"name_en": "Colleges & Hospitals", "name_ar": "\u0643\u0644\u064A\u0627\u062A \u0648\u0645\u0633\u062A\u0634\u0641\u064A\u0627\u062A", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}]'::jsonb,
    true, false, 5
  ),

  -- 6. Riyadh - Al-Yarmouk 1
  (
    '00000000-0000-0000-0000-000000000006',
    'riyadh-alyarmouk-1',
    'Riyadh', E'\u0627\u0644\u0631\u064A\u0627\u0636',
    'Al-Yarmouk', E'\u0627\u0644\u064A\u0631\u0645\u0648\u0643 \u0661',
    'Located in Al-Yarmouk neighborhood in Riyadh, a well-established residential area with excellent facilities.',
    E'\u062D\u064A \u0627\u0644\u064A\u0631\u0645\u0648\u0643 \u0627\u0644\u0631\u0627\u0642\u064A \u0628\u0627\u0644\u0631\u064A\u0627\u0636 - \u0645\u0646\u0637\u0642\u0629 \u0633\u0643\u0646\u064A\u0629 \u0622\u0645\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0645\u0639 \u0645\u0631\u0627\u0641\u0642 \u0645\u0645\u062A\u0627\u0632\u0629. \u0645\u0648\u0642\u0639 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A \u0642\u0631\u064A\u0628 \u0645\u0646 \u0627\u0644\u062C\u0627\u0645\u0639\u0627\u062A \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A.',
    NULL,
    'https://maps.app.goo.gl/wFivqUUKo3YG91QB6?g_st=ic',
    '[{"name_en": "Metro Station", "name_ar": "\u0645\u062D\u0637\u0629 \u0627\u0644\u0645\u064A\u062A\u0631\u0648", "distance_en": "8 minutes", "distance_ar": "8 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Riyadh Park Mall", "name_ar": "\u0627\u0644\u0631\u064A\u0627\u0636 \u0628\u0627\u0631\u0643 \u0645\u0648\u0644", "distance_en": "10 minutes", "distance_ar": "10 \u062F\u0642\u0627\u0626\u0642"}]'::jsonb,
    true, false, 6
  ),

  -- 7. Riyadh - Al-Yarmouk 2
  (
    '00000000-0000-0000-0000-000000000007',
    'riyadh-alyarmouk-2',
    'Riyadh', E'\u0627\u0644\u0631\u064A\u0627\u0636',
    'Al-Yarmouk', E'\u0627\u0644\u064A\u0631\u0645\u0648\u0643 \u0662',
    'Coming soon - Located in Al-Yarmouk neighborhood in Riyadh, a well-established residential area with excellent facilities.',
    E'\u0642\u0631\u064A\u0628\u0627\u064B - \u062D\u064A \u0627\u0644\u064A\u0631\u0645\u0648\u0643 \u0627\u0644\u0631\u0627\u0642\u064A \u0628\u0627\u0644\u0631\u064A\u0627\u0636 - \u0645\u0646\u0637\u0642\u0629 \u0633\u0643\u0646\u064A\u0629 \u0622\u0645\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0645\u0639 \u0645\u0631\u0627\u0641\u0642 \u0645\u0645\u062A\u0627\u0632\u0629. \u0645\u0648\u0642\u0639 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A \u0642\u0631\u064A\u0628 \u0645\u0646 \u0627\u0644\u062C\u0627\u0645\u0639\u0627\u062A \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A.',
    NULL,
    'https://maps.app.goo.gl/wFivqUUKo3YG91QB6?g_st=ic',
    '[{"name_en": "Metro Station", "name_ar": "\u0645\u062D\u0637\u0629 \u0627\u0644\u0645\u064A\u062A\u0631\u0648", "distance_en": "8 minutes", "distance_ar": "8 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Riyadh Park Mall", "name_ar": "\u0627\u0644\u0631\u064A\u0627\u0636 \u0628\u0627\u0631\u0643 \u0645\u0648\u0644", "distance_en": "10 minutes", "distance_ar": "10 \u062F\u0642\u0627\u0626\u0642"}]'::jsonb,
    true, false, 7
  ),

  -- 8. Riyadh - Al-Aridh
  (
    '00000000-0000-0000-0000-000000000008',
    'riyadh-alaridh',
    'Riyadh', E'\u0627\u0644\u0631\u064A\u0627\u0636',
    'Al-Aridh', E'\u0627\u0644\u0639\u0627\u0631\u0636',
    'Located in one of the finest neighborhoods in Riyadh, near King Salman Road and Abu Bakr Al-Siddiq Road.',
    E'\u062D\u064A \u0627\u0644\u0639\u0627\u0631\u0636 \u0627\u0644\u0631\u0627\u0642\u064A \u062C\u062F\u0627\u064B \u0628\u0627\u0644\u0631\u064A\u0627\u0636 - \u0623\u062D\u062F \u0623\u0631\u0642\u0649 \u0627\u0644\u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0641\u064A \u0627\u0644\u0645\u0645\u0644\u0643\u0629. \u0628\u064A\u0626\u0629 \u0622\u0645\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0645\u0639 \u062E\u062F\u0645\u0627\u062A \u0639\u0627\u0644\u064A\u0629 \u0627\u0644\u062C\u0648\u062F\u0629 \u0648\u0642\u0631\u064A\u0628 \u0645\u0646 \u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0623\u0645\u064A\u0631\u0629 \u0646\u0648\u0631\u0629.',
    NULL,
    'https://maps.app.goo.gl/a28rhz9mh7RENndr6?g_st=ic',
    '[{"name_en": "SAB Metro Station", "name_ar": "\u0645\u062D\u0637\u0629 \u0645\u064A\u062A\u0631\u0648 \u0633\u0627\u0628", "distance_en": "10 minutes", "distance_ar": "10 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Princess Nourah University", "name_ar": "\u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0623\u0645\u064A\u0631\u0629 \u0646\u0648\u0631\u0629", "distance_en": "15 minutes", "distance_ar": "15 \u062F\u0642\u064A\u0642\u0629"}, {"name_en": "Dallah Hospital (Al-Aridh)", "name_ar": "\u0645\u0633\u062A\u0634\u0641\u0649 \u062F\u0644\u0629 (\u0627\u0644\u0639\u0627\u0631\u0636)", "distance_en": "3 minutes", "distance_ar": "3 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Al-Habib Clinics (Al-Narjis)", "name_ar": "\u0639\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u062D\u0628\u064A\u0628 (\u0627\u0644\u0646\u0631\u062C\u0633)", "distance_en": "5 minutes", "distance_ar": "5 \u062F\u0642\u0627\u0626\u0642"}]'::jsonb,
    true, false, 8
  );

-- ============================================================================
-- ROOMS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Building 1: khobar-alolaya (00000000-0000-0000-0000-000000000001)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'triple',  'private', 1050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'double',  'shared',  1550, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'double',  'private', 1699, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'double',  'master',  1850, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'single',  'shared',  2199, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'single',  'private', 2499, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'single',  'master',  2899, NULL);

-- ---------------------------------------------------------------------------
-- Building 2: khobar-alandalus (00000000-0000-0000-0000-000000000002)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'triple',  'private',           1050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'triple',  'private-balcony',   1200, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'double',  'shared',            1550, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'double',  'private',           1699, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'double',  'master',            1850, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'shared-b',          1999, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'shared-a',          2299, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'shared-balcony',    2499, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'private',           2900, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'master',            3050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'master-balcony',    3250, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'suite',   'private',           3400, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'suite',   'private-two-rooms', 3999, NULL);

-- ---------------------------------------------------------------------------
-- Building 3: khobar-alrakah (00000000-0000-0000-0000-000000000003)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'triple',  'private',  1050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'triple',  'suite',    1200, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'double',  'shared-b', 1350, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'double',  'shared-a', 1550, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'double',  'master-b', 1599, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'double',  'master-a', 1700, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'double',  'suite',    2199, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'single',  'shared-b', 1999, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'single',  'shared-a', 2499, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'single',  'master',   2899, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'suite',   'private',  3400, NULL);

-- ---------------------------------------------------------------------------
-- Building 4: dammam-alaziziah (00000000-0000-0000-0000-000000000004)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'triple',  'private', 1050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'double',  'private', 1699, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'double',  'master',  1850, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'single',  'private', 2499, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'single',  'master',  2699, NULL);

-- ---------------------------------------------------------------------------
-- Building 5: jubail-jalmudah (00000000-0000-0000-0000-000000000005)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'triple',  'private', 1050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'double',  'shared',  1550, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'double',  'private', 1699, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'double',  'master',  1850, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'single',  'shared',  1999, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'single',  'private', 2499, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'single',  'master',  2899, NULL);

-- ---------------------------------------------------------------------------
-- Building 6: riyadh-alyarmouk-1 (00000000-0000-0000-0000-000000000006)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'triple',  'private',         2000, 1750),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'double',  'shared',          2800, 2450),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'double',  'private',         2900, 2550),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'double',  'master',          3100, 2700),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'single',  'shared',          4400, 3850),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'single',  'shared-balcony',  4550, 3950),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'single',  'private',         4600, 4050),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'single',  'private-balcony', 4750, 4150),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'single',  'master',          4900, 4300),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'suite',   'private',         5500, 4800);

-- ---------------------------------------------------------------------------
-- Building 7: riyadh-alyarmouk-2 (00000000-0000-0000-0000-000000000007)
-- Same room types and prices as riyadh-alyarmouk-1
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'triple',  'private',         2000, 1750),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'double',  'shared',          2800, 2450),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'double',  'private',         2900, 2550),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'double',  'master',          3100, 2700),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'single',  'shared',          4400, 3850),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'single',  'shared-balcony',  4550, 3950),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'single',  'private',         4600, 4050),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'single',  'private-balcony', 4750, 4150),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'single',  'master',          4900, 4300),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'suite',   'private',         5500, 4800);

-- ---------------------------------------------------------------------------
-- Building 8: riyadh-alaridh (00000000-0000-0000-0000-000000000008)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'triple',  'private', 1898, 1650),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'double',  'shared',  2645, 2290),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'double',  'private', 2760, 2390),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'double',  'master',  2818, 2490),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'single',  'shared',  4255, 3700),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'single',  'private', 4485, 3900),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'single',  'master',  4700, 3950),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'suite',   'private', 5500, 4800);

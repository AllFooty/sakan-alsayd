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

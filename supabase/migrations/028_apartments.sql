-- ============================================================================
-- Migration 028: Apartments layer (Slice 1 of Apartments feature)
-- ============================================================================
--
-- Background. Today the physical hierarchy is Building -> (floor int on
-- rooms) -> Room. There is no entity for the apartment (شقة) — the
-- self-contained unit that contains 1-3 rooms plus shared kitchen, living
-- room, and bathroom(s). Adding apartments lets us:
--   - target apartment-shared maintenance (kitchen, hallway AC, water heater)
--   - show residents their apartment-mates (gender separation, supervision)
--   - expose richer context on the public site ("private room in 3-bedroom
--     apartment, shared kitchen with 2 students")
--
-- This migration is read-side only: it creates the table, adds the FK on
-- rooms (NOT NULL after backfill), wires triggers to keep rooms.floor in
-- sync as a denormalized cache, and adds an optional apartment_id to
-- maintenance_requests (auto-filled from room_id).
--
-- Per the plan, leases stay per-room — room_assignments is untouched.
-- ============================================================================

-- ----- Part 1: apartments table -------------------------------------------

CREATE TABLE IF NOT EXISTS public.apartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  apartment_number TEXT NOT NULL,
  floor INTEGER NOT NULL,

  description_en TEXT NOT NULL DEFAULT '',
  description_ar TEXT NOT NULL DEFAULT '',
  notes TEXT,

  has_kitchen BOOLEAN NOT NULL DEFAULT true,
  has_living_room BOOLEAN NOT NULL DEFAULT false,
  shared_bathroom_count INTEGER NOT NULL DEFAULT 1
    CHECK (shared_bathroom_count >= 0),
  private_bathroom_count INTEGER NOT NULL DEFAULT 0
    CHECK (private_bathroom_count >= 0),

  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT apartments_building_number_unique
    UNIQUE (building_id, apartment_number)
);

CREATE INDEX IF NOT EXISTS idx_apartments_building_floor
  ON public.apartments (building_id, floor, sort_order);

CREATE INDEX IF NOT EXISTS idx_apartments_active
  ON public.apartments (is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_apartments_updated_at ON public.apartments;
CREATE TRIGGER trg_apartments_updated_at
  BEFORE UPDATE ON public.apartments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----- Part 2: rooms.apartment_id (nullable initially) --------------------

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS apartment_id UUID
    REFERENCES public.apartments(id) ON DELETE RESTRICT;

-- ----- Part 3: backfill -----------------------------------------------------
--
-- For each existing (building_id, COALESCE(floor, 0)) pair, create one
-- default apartment named "F{n}-DEFAULT" and assign every matching room to
-- it. The naming is deliberately ugly so admins notice and rename later
-- (split into real A1/B1/C1 apartments via the upcoming Slice 2 UI).
--
-- Rooms with NULL floor land in F0-DEFAULT (data-quality outlier). After
-- this migration, rooms.floor stays as a denormalized cache of the
-- apartment's floor; a trigger keeps the two in sync.

INSERT INTO public.apartments (
  building_id,
  apartment_number,
  floor,
  description_en,
  description_ar,
  sort_order
)
SELECT DISTINCT
  r.building_id,
  'F' || COALESCE(r.floor, 0)::text || '-DEFAULT',
  COALESCE(r.floor, 0),
  'Default apartment auto-created for floor ' || COALESCE(r.floor, 0)::text,
  'شقة افتراضية تم إنشاؤها تلقائيا للطابق ' || COALESCE(r.floor, 0)::text,
  COALESCE(r.floor, 0)
FROM public.rooms r
ON CONFLICT (building_id, apartment_number) DO NOTHING;

UPDATE public.rooms r
SET apartment_id = a.id
FROM public.apartments a
WHERE a.building_id = r.building_id
  AND a.floor = COALESCE(r.floor, 0)
  AND a.apartment_number = 'F' || COALESCE(r.floor, 0)::text || '-DEFAULT'
  AND r.apartment_id IS NULL;

-- Now enforce NOT NULL.
ALTER TABLE public.rooms ALTER COLUMN apartment_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_apartment ON public.rooms (apartment_id);

-- ----- Part 4: maintenance_requests.apartment_id (optional) ---------------

ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS apartment_id UUID
    REFERENCES public.apartments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_apartment_id
  ON public.maintenance_requests (apartment_id);

-- Backfill existing maintenance rows: copy apartment from the room they
-- already point at, where applicable.
UPDATE public.maintenance_requests m
SET apartment_id = r.apartment_id
FROM public.rooms r
WHERE m.room_id = r.id
  AND m.apartment_id IS NULL;

-- ----- Part 5: triggers -----------------------------------------------------

-- 5a. When a room's apartment_id is set/changed (or a room is inserted),
-- copy the apartment's floor onto the room. Keeps rooms.floor a true cache.
CREATE OR REPLACE FUNCTION public.sync_room_floor_from_apartment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_floor integer;
BEGIN
  IF NEW.apartment_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.apartment_id IS NOT DISTINCT FROM OLD.apartment_id THEN
    RETURN NEW;
  END IF;

  SELECT floor INTO v_floor
    FROM public.apartments
    WHERE id = NEW.apartment_id;

  IF v_floor IS NOT NULL THEN
    NEW.floor := v_floor;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_room_apartment_floor_sync ON public.rooms;
CREATE TRIGGER trg_room_apartment_floor_sync
  BEFORE INSERT OR UPDATE OF apartment_id ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_room_floor_from_apartment();

-- 5b. When an apartment's floor is updated, propagate to its rooms so the
-- rooms.floor cache stays consistent with the apartment.
CREATE OR REPLACE FUNCTION public.propagate_apartment_floor_to_rooms()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.floor IS DISTINCT FROM OLD.floor THEN
    UPDATE public.rooms
      SET floor = NEW.floor
      WHERE apartment_id = NEW.id
        AND (floor IS DISTINCT FROM NEW.floor);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_apartment_floor_propagate ON public.apartments;
CREATE TRIGGER trg_apartment_floor_propagate
  AFTER UPDATE OF floor ON public.apartments
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_apartment_floor_to_rooms();

-- 5c. On maintenance_requests, when room_id is set, derive apartment_id from
-- the room. This guarantees apartment_id is consistent with room_id without
-- forcing app code to remember to pass both. Apartment-shared issues (no
-- room_id) can still pass apartment_id directly.
CREATE OR REPLACE FUNCTION public.maintenance_fill_apartment_from_room()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_apartment uuid;
BEGIN
  IF NEW.room_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only refresh on INSERT or when room_id actually changed; otherwise an
  -- explicit apartment_id update on the same row would be overwritten.
  IF TG_OP = 'UPDATE'
     AND NEW.room_id IS NOT DISTINCT FROM OLD.room_id THEN
    RETURN NEW;
  END IF;

  SELECT apartment_id INTO v_apartment
    FROM public.rooms
    WHERE id = NEW.room_id;

  IF v_apartment IS NOT NULL THEN
    NEW.apartment_id := v_apartment;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintenance_fill_apartment ON public.maintenance_requests;
CREATE TRIGGER trg_maintenance_fill_apartment
  BEFORE INSERT OR UPDATE OF room_id ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.maintenance_fill_apartment_from_room();

-- ----- Part 6: RLS ---------------------------------------------------------
-- Mirror the rooms RLS pattern. Authenticated users can SELECT all (admin
-- portal scope is enforced at the API layer via authenticateApiRequest +
-- getAssignedBuildingIds). Anon users only see apartments under active
-- buildings (matches rooms_anon_select). Writes are super_admin OR scoped
-- to assigned buildings. Roles are gated at the API.

ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apartments_auth_select" ON public.apartments;
CREATE POLICY "apartments_auth_select" ON public.apartments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "apartments_anon_select" ON public.apartments;
CREATE POLICY "apartments_anon_select" ON public.apartments
  FOR SELECT TO anon
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.buildings b
      WHERE b.id = building_id AND b.is_active = true
    )
  );

DROP POLICY IF EXISTS "apartments_admin_all" ON public.apartments;
CREATE POLICY "apartments_admin_all" ON public.apartments
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "apartments_manager_insert" ON public.apartments;
CREATE POLICY "apartments_manager_insert" ON public.apartments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_assigned_to_building(building_id));

DROP POLICY IF EXISTS "apartments_manager_update" ON public.apartments;
CREATE POLICY "apartments_manager_update" ON public.apartments
  FOR UPDATE TO authenticated
  USING (public.is_assigned_to_building(building_id))
  WITH CHECK (public.is_assigned_to_building(building_id));

DROP POLICY IF EXISTS "apartments_manager_delete" ON public.apartments;
CREATE POLICY "apartments_manager_delete" ON public.apartments
  FOR DELETE TO authenticated
  USING (public.is_assigned_to_building(building_id));

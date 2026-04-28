-- Add explicit capacity and occupancy_mode to rooms.
--
-- These two columns model the orthogonal Arabic dimensions used by ops:
--   capacity        — أحادي / ثنائي / ثلاثي → 1 / 2 / 3 beds
--   occupancy_mode  — خاص (private: room rents as one unit) vs مشترك
--                     (shared: each bed rents independently)
--
-- The pre-existing room_type enum (single/double/triple/suite) implicitly
-- carried capacity, but staff need to override it (e.g., a "suite" with 4
-- beds) and the occupancy mode was not represented at all. Both are needed
-- by the upcoming Building Vacancy Heatmap views.

CREATE TYPE room_occupancy_mode AS ENUM ('private', 'shared');

ALTER TABLE rooms
  ADD COLUMN capacity INTEGER NOT NULL DEFAULT 1
    CHECK (capacity >= 1 AND capacity <= 20),
  ADD COLUMN occupancy_mode room_occupancy_mode NOT NULL DEFAULT 'private';

-- Backfill capacity from the existing room_type. "suite" defaults to 2 because
-- it's the most conservative starting point — staff edit upward via the form
-- when a suite actually holds more.
UPDATE rooms SET capacity = CASE room_type
  WHEN 'single' THEN 1
  WHEN 'double' THEN 2
  WHEN 'triple' THEN 3
  WHEN 'suite'  THEN 2
END;

-- occupancy_mode keeps its 'private' default for all existing rows. Staff
-- flip known shared rooms to 'shared' via the admin form post-deploy. We do
-- not backfill heuristically because (a) singles can only be private, (b)
-- the set of مشترك rooms is operator knowledge we don't have, and (c) UI
-- correction is safer than a guessed SQL backfill.

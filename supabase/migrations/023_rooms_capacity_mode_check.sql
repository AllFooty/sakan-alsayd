-- Enforce the joint constraint that the API and UI already enforce: a
-- 1-bed room cannot be 'shared' (there's no second tenant to share with).
-- Without this DB-level check, a direct SQL edit, future migration, or
-- bulk import could insert nonsensical state that breaks the floor map's
-- bed math (capacity=1 + shared would render an oddball half-occupied
-- single).

-- Defensive cleanup before adding the constraint — flip any pre-existing
-- offenders to 'private', mirroring what POST /api/admin/rooms does at the
-- API boundary. This should be a no-op on dev/prod since migration 021
-- defaulted everything to 'private', but the cleanup keeps the migration
-- idempotent against hand-edited rows.
UPDATE rooms
SET occupancy_mode = 'private'
WHERE capacity = 1 AND occupancy_mode = 'shared';

ALTER TABLE rooms
  ADD CONSTRAINT rooms_capacity_mode_check
    CHECK (NOT (capacity = 1 AND occupancy_mode = 'shared'));

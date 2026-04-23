-- ============================================================================
-- Migration 009: Maintenance Summary Refactor
-- ============================================================================
-- Retires `title` as a required field on maintenance_requests. The short
-- description becomes the primary summary (≤150 chars, enforced at the
-- application layer), and a new `extra_details` column captures long-form
-- text when the summary isn't enough.
--
-- The `title` column is kept (made nullable) to preserve historical data and
-- allow easy rollback. A one-time backfill copies title into description for
-- any legacy row whose description is empty, so the admin Summary column
-- isn't blank for existing records.
-- ============================================================================

ALTER TABLE maintenance_requests
  ALTER COLUMN title DROP NOT NULL;

ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS extra_details TEXT;

UPDATE maintenance_requests
SET description = LEFT(title, 150)
WHERE (description IS NULL OR description = '')
  AND title IS NOT NULL
  AND title <> '';

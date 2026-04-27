-- ============================================================================
-- Migration 011: Role expansion — add 4 new values to user_role enum
-- ============================================================================
-- Adds department-manager tier and a deputy-GM role above branch_manager.
--   - maintenance_manager       (peer of maintenance_staff, manager tier)
--   - transportation_manager    (peer of transportation_staff, manager tier)
--   - finance_manager           (peer of finance_staff, manager tier)
--   - deputy_general_manager    (super_admin-equivalent, except user mgmt)
--
-- Postgres allows ADD VALUE inside a transaction, but the new values cannot
-- be referenced in the SAME transaction. RLS policy updates that reference
-- these values therefore live in migration 012.
-- ============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'maintenance_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'transportation_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'finance_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'deputy_general_manager';

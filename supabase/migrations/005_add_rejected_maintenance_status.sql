-- Add 'rejected' status to maintenance_status enum
-- Allows staff to formally reject a maintenance request (reviewed and denied)
-- as distinct from 'cancelled' (withdrawn or voided)
ALTER TYPE maintenance_status ADD VALUE IF NOT EXISTS 'rejected' AFTER 'completed';

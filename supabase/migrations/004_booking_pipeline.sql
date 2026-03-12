-- Migration 004: Booking Pipeline Upgrade
-- Adds new status values to support 3-department handoff workflow:
-- Customer Service → Finance → Supervision

-- Add new status values to existing enum
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_payment';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending_onboarding';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Migrate existing data from old statuses to new ones
UPDATE booking_requests SET status = 'in_review' WHERE status = 'contacted';
UPDATE booking_requests SET status = 'completed' WHERE status = 'confirmed';

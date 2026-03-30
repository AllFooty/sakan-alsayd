-- Add new columns to booking_requests for extended booking form
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS with_transportation BOOLEAN DEFAULT false;
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

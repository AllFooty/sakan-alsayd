-- ============================================================================
-- Migration 007: Create maintenance-photos storage bucket
-- ============================================================================
-- Creates a private storage bucket for maintenance request photo uploads.
-- Bucket config: 5MB limit, JPEG/PNG/WebP only, private (signed URLs).
-- ============================================================================

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-photos',
  'maintenance-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users to read objects (needed for signed URL generation)
CREATE POLICY "Authenticated users can read maintenance photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'maintenance-photos');

-- 3. Allow authenticated staff to upload photos to existing requests
CREATE POLICY "Staff can upload maintenance photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'maintenance-photos');

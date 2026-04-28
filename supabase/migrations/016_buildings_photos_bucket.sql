-- ============================================================================
-- Migration 016: Create buildings-photos storage bucket
-- ============================================================================
-- Public bucket for building cover photos and image galleries. URLs stored
-- directly in buildings.cover_image and buildings.images[] are loaded via
-- next/image, so the bucket is public-read; writes are scoped to staff with
-- a path prefix matching an existing building UUID.
-- ============================================================================

-- 1. Create the bucket (public read, 5 MB max, JPEG/PNG/WebP only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'buildings-photos',
  'buildings-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Public read (explicit policy alongside bucket.public=true so signed-URL
-- generation also works for authenticated callers)
CREATE POLICY "Anyone can read buildings photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'buildings-photos');

-- 3. Active staff can upload to a path that starts with an existing building UUID
CREATE POLICY "Staff can upload buildings photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'buildings-photos'
  AND EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = auth.uid() AND is_active
  )
  AND EXISTS (
    SELECT 1 FROM public.buildings
    WHERE id::text = split_part(name, '/', 1)
  )
);

-- 4. Privileged staff can delete (cleanup, replace cover, etc.)
CREATE POLICY "Privileged staff can delete buildings photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'buildings-photos'
  AND EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = auth.uid()
      AND is_active
      AND role IN ('super_admin', 'deputy_general_manager', 'branch_manager')
  )
);

-- 5. Privileged staff can update (rename/move objects)
CREATE POLICY "Privileged staff can update buildings photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'buildings-photos'
  AND EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = auth.uid()
      AND is_active
      AND role IN ('super_admin', 'deputy_general_manager', 'branch_manager')
  )
);

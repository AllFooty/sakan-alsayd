-- ============================================================================
-- Migration 008: Tighten RLS for maintenance-photos storage bucket
-- ============================================================================
-- Replaces the permissive INSERT policy from migration 007 (which allowed any
-- authenticated user to upload to any path in the bucket) with a policy that
-- binds uploads to either the 'temp/' staging folder or an existing maintenance
-- request UUID. Also adds UPDATE/DELETE policies for privileged roles so
-- orphan photos can actually be cleaned up.
-- ============================================================================

-- 1. Drop the permissive INSERT policy from 007
DROP POLICY IF EXISTS "Staff can upload maintenance photos" ON storage.objects;

-- 2. Allow INSERT only when the path prefix is either 'temp' or an existing request UUID
CREATE POLICY "Staff can upload maintenance photos (bound to request)"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'maintenance-photos'
  AND (
    split_part(name, '/', 1) = 'temp'
    OR EXISTS (
      SELECT 1 FROM public.maintenance_requests
      WHERE id::text = split_part(name, '/', 1)
    )
  )
);

-- 3. Allow DELETE only to privileged roles (cleanup, reorganisation)
CREATE POLICY "Privileged staff can delete maintenance photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'maintenance-photos'
  AND EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = auth.uid()
      AND is_active
      AND role IN ('super_admin', 'branch_manager', 'maintenance_staff')
  )
);

-- 4. Allow UPDATE only to privileged roles (rename/move)
CREATE POLICY "Privileged staff can update maintenance photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'maintenance-photos'
  AND EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = auth.uid()
      AND is_active
      AND role IN ('super_admin', 'branch_manager', 'maintenance_staff')
  )
);

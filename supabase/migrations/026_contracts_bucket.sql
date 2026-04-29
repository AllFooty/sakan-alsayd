-- ============================================================================
-- Migration 026: Create the private `contracts` storage bucket
-- ============================================================================
-- Private bucket for resident contract documents (PDFs + images). Files are
-- stored at path `{resident_uuid}/{uuid}__{slug}.{ext}` so RLS can extract
-- the resident_id from the first path segment.
--
-- Access rules:
--   - Bucket is PRIVATE (public=false). Direct URLs return 403; downloads
--     require server-generated signed URLs (5-minute TTL).
--   - super_admin / deputy_general_manager: full access to every contract.
--   - branch_manager / supervision_staff: scoped — they can read/write
--     contracts for residents who have at least one room_assignment (any
--     status) in a building they're assigned to via
--     staff_building_assignments.
--   - All other roles, anonymous: no access.
-- ============================================================================

-- 1. Create the bucket (private, 10 MB max, PDF + JPEG/PNG only).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Helper function — `true` when the calling user can access contracts for
-- the given resident. SECURITY INVOKER so the function honors RLS on the
-- underlying tables; STABLE because it has no side effects within a stmt.
CREATE OR REPLACE FUNCTION public.can_access_resident_contracts(p_resident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    -- Admin-tier always passes.
    EXISTS (
      SELECT 1 FROM public.staff_profiles
      WHERE id = auth.uid()
        AND is_active
        AND role IN ('super_admin', 'deputy_general_manager')
    )
    OR
    -- Branch / supervision staff: must share at least one building with
    -- the resident's assignment history.
    EXISTS (
      SELECT 1
      FROM public.staff_profiles sp
      JOIN public.staff_building_assignments sba ON sba.staff_id = sp.id
      JOIN public.room_assignments ra ON ra.building_id = sba.building_id
      WHERE sp.id = auth.uid()
        AND sp.is_active
        AND sp.role IN ('branch_manager', 'supervision_staff')
        AND ra.resident_id = p_resident_id
    );
$$;

-- 3. RLS policies on storage.objects scoped to bucket 'contracts'.
-- Path layout: `<resident_uuid>/<filename>` — split_part lifts the prefix.

-- SELECT: read access for signed-URL generation.
DROP POLICY IF EXISTS "Staff can read contracts for their residents" ON storage.objects;
CREATE POLICY "Staff can read contracts for their residents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contracts'
  AND public.can_access_resident_contracts(
    (split_part(name, '/', 1))::uuid
  )
);

-- INSERT: upload access. Same scope as SELECT.
DROP POLICY IF EXISTS "Staff can upload contracts for their residents" ON storage.objects;
CREATE POLICY "Staff can upload contracts for their residents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contracts'
  AND public.can_access_resident_contracts(
    (split_part(name, '/', 1))::uuid
  )
);

-- DELETE: same scope. Admin-tier always; branch_manager/supervision_staff
-- if the resident has an assignment in their building.
DROP POLICY IF EXISTS "Staff can delete contracts for their residents" ON storage.objects;
CREATE POLICY "Staff can delete contracts for their residents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contracts'
  AND public.can_access_resident_contracts(
    (split_part(name, '/', 1))::uuid
  )
);

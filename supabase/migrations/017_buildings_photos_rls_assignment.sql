-- ============================================================================
-- Migration 017: Tighten buildings-photos storage RLS to enforce assignment
-- ============================================================================
-- Migration 016 created INSERT/UPDATE/DELETE policies that gated only on
-- "active staff_profile" (INSERT) or "active staff in admin/branch_manager
-- role list" (UPDATE/DELETE). Neither variant checked that the staff member
-- is *assigned* to the building whose UUID prefixes the storage path.
--
-- The admin API at `src/app/api/uploads/building-photo/route.ts` enforces the
-- assignment check before issuing the upload — but a logged-in branch_manager
-- could bypass the API and call Supabase storage directly with their JWT to
-- pollute another building's path. Defense-in-depth: enforce the same
-- super_admin / deputy_general_manager / branch_manager-with-assignment rule
-- inside RLS, matching what the API gate already does.
-- ============================================================================

-- 1. INSERT — admin tier OR branch_manager assigned to the building UUID prefix
DROP POLICY IF EXISTS "Staff can upload buildings photos" ON storage.objects;
CREATE POLICY "Staff can upload buildings photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'buildings-photos'
  AND EXISTS (
    SELECT 1 FROM public.staff_profiles sp
    WHERE sp.id = auth.uid()
      AND sp.is_active
      AND (
        sp.role IN ('super_admin', 'deputy_general_manager')
        OR (
          sp.role = 'branch_manager'
          AND public.is_assigned_to_building(
            split_part(name, '/', 1)::uuid
          )
        )
      )
  )
  AND EXISTS (
    SELECT 1 FROM public.buildings
    WHERE id::text = split_part(name, '/', 1)
  )
);

-- 2. UPDATE — same gate as INSERT (rename/move objects)
DROP POLICY IF EXISTS "Privileged staff can update buildings photos" ON storage.objects;
CREATE POLICY "Privileged staff can update buildings photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'buildings-photos'
  AND EXISTS (
    SELECT 1 FROM public.staff_profiles sp
    WHERE sp.id = auth.uid()
      AND sp.is_active
      AND (
        sp.role IN ('super_admin', 'deputy_general_manager')
        OR (
          sp.role = 'branch_manager'
          AND public.is_assigned_to_building(
            split_part(name, '/', 1)::uuid
          )
        )
      )
  )
);

-- 3. DELETE — same gate (cleanup, replace cover, etc.)
DROP POLICY IF EXISTS "Privileged staff can delete buildings photos" ON storage.objects;
CREATE POLICY "Privileged staff can delete buildings photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'buildings-photos'
  AND EXISTS (
    SELECT 1 FROM public.staff_profiles sp
    WHERE sp.id = auth.uid()
      AND sp.is_active
      AND (
        sp.role IN ('super_admin', 'deputy_general_manager')
        OR (
          sp.role = 'branch_manager'
          AND public.is_assigned_to_building(
            split_part(name, '/', 1)::uuid
          )
        )
      )
  )
);

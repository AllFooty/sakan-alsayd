-- ============================================================================
-- Migration 018: Tighten buildings-photos INSERT RLS to refuse uploads to
-- soft-deleted (is_active=false) buildings.
-- ============================================================================
-- The admin API at `src/app/api/uploads/building-photo/route.ts` already
-- returns 409 `buildingInactive` when the target building is soft-deleted.
-- Defense-in-depth: enforce the same rule at the storage RLS layer so a
-- branch_manager calling Supabase storage directly with their JWT can't
-- bypass the API gate to write to a deactivated building's prefix. Mirrors
-- migration 017's approach of pulling API-side rules into RLS.
--
-- UPDATE/DELETE remain unchanged: deleting orphaned objects on a
-- soft-deleted building is legitimate cleanup and rooms DELETE has the same
-- carve-out (audit MED#5).
-- ============================================================================

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
      AND is_active
  )
);

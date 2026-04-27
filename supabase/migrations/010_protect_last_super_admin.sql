-- ============================================================================
-- Protect against losing the last active super_admin under concurrent writes.
--
-- The user-management API previously enforced this with an application-level
-- count + update, which is racy: two concurrent demotions of two different
-- active super_admins both pass the count check and both succeed, leaving
-- zero active super_admins. We move the guard into the database via a
-- BEFORE UPDATE / DELETE trigger on staff_profiles. The trigger takes an
-- advisory lock to serialize concurrent updates that touch the super_admin
-- pool (eliminating the TOCTOU race) and aborts with `last_super_admin` if
-- the change would empty the active super_admin set. The user-management
-- API at /api/admin/users/[id] surfaces this code as `lastSuperAdmin` 400.
-- ============================================================================

-- Stable lock id derived from a salted hash of "staff_profiles:super_admin_pool".
-- pg_advisory_xact_lock takes a bigint; any deterministic id works.
CREATE OR REPLACE FUNCTION public._super_admin_lock()
RETURNS void AS $$
  SELECT pg_advisory_xact_lock(8675309001::bigint);
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION public.protect_last_super_admin()
RETURNS trigger AS $$
DECLARE
  remaining_count integer;
BEGIN
  -- Only relevant if this update could remove an active super_admin.
  IF OLD.role = 'super_admin' AND OLD.is_active = true
     AND (NEW.role <> 'super_admin' OR NEW.is_active = false) THEN

    -- Serialize all updates that affect the super_admin pool inside the
    -- transaction. Concurrent updates wait here.
    PERFORM public._super_admin_lock();

    SELECT count(*) INTO remaining_count
    FROM public.staff_profiles
    WHERE role = 'super_admin'
      AND is_active = true
      AND id <> OLD.id;

    IF remaining_count = 0 THEN
      RAISE EXCEPTION 'last_super_admin'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_last_super_admin ON public.staff_profiles;
CREATE TRIGGER trg_protect_last_super_admin
  BEFORE UPDATE OF role, is_active ON public.staff_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_last_super_admin();

-- Same protection for hard deletes (in case anyone bypasses the API and
-- runs a raw DELETE — the API itself returns 405, but defense in depth).
CREATE OR REPLACE FUNCTION public.protect_last_super_admin_on_delete()
RETURNS trigger AS $$
DECLARE
  remaining_count integer;
BEGIN
  IF OLD.role = 'super_admin' AND OLD.is_active = true THEN
    PERFORM public._super_admin_lock();

    SELECT count(*) INTO remaining_count
    FROM public.staff_profiles
    WHERE role = 'super_admin'
      AND is_active = true
      AND id <> OLD.id;

    IF remaining_count = 0 THEN
      RAISE EXCEPTION 'last_super_admin'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_last_super_admin_delete ON public.staff_profiles;
CREATE TRIGGER trg_protect_last_super_admin_delete
  BEFORE DELETE ON public.staff_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_last_super_admin_on_delete();

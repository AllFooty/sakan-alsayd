-- Grant maintenance_manager VIEW-ONLY access to booking_requests and booking_request_notes.
-- Maintenance manager needs visibility into the booking pipeline (e.g. to anticipate
-- incoming residents and prepare maintenance schedules) without write permissions.
--
-- Pairs with API-side change: maintenance_manager added to authenticateApiRequest()
-- on the GET handlers in src/app/api/booking-requests/{route,[id]/route,[id]/notes/route}.ts.
-- Write handlers (PATCH/POST/DELETE) intentionally remain unchanged so the role
-- stays read-only.

-- booking_requests SELECT
DROP POLICY IF EXISTS "bookings_staff_select" ON public.booking_requests;
CREATE POLICY "bookings_staff_select" ON public.booking_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'finance_staff', 'finance_manager', 'maintenance_manager')
  );

-- booking_request_notes SELECT
DROP POLICY IF EXISTS "booking_notes_staff_select" ON public.booking_request_notes;
CREATE POLICY "booking_notes_staff_select" ON public.booking_request_notes
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.staff_profiles WHERE id = auth.uid()) IN
      ('branch_manager', 'supervision_staff', 'finance_staff', 'finance_manager', 'maintenance_manager')
  );

-- (booking_notes_staff_insert intentionally NOT updated — maintenance_manager
--  must not write notes on bookings.)

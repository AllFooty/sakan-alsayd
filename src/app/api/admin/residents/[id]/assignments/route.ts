import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';
import { normalizeCapacity } from '@/lib/rooms/occupancy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface ResidentLookupRow {
  id: string;
  full_name: string;
  status: 'active' | 'checked_out' | 'suspended';
}

interface RoomLookupRow {
  id: string;
  building_id: string;
  capacity: number | null;
  occupancy_mode: 'private' | 'shared' | null;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

interface AssignmentInsertRow {
  id: string;
}

// POST /api/admin/residents/[id]/assignments
//
// Move-in: create a new active room_assignment for a resident and (if
// necessary) flip the room.status to reflect the new active count.
//
// NOTE: This endpoint performs sequential writes (assignment INSERT, then a
// conditional rooms UPDATE). There is NO database transaction wrapping the
// pair, so a small race window exists where the assignment row is committed
// but the room.status update lags or fails. This matches the pattern used by
// the existing booking and maintenance pipelines in this codebase. If the
// rooms UPDATE fails after a successful assignment INSERT we log a console
// error for manual reconciliation rather than rolling back — the assignment
// is the source of truth and the next vacancy recompute will self-heal.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: residentId } = await params;
    if (!UUID_RE.test(residentId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const auth = await authenticateApiRequest('branch_manager', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalidBody' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    const room_id = typeof b.room_id === 'string' ? b.room_id.trim() : '';
    if (!room_id || !UUID_RE.test(room_id)) {
      return NextResponse.json({ error: 'invalidRoomId' }, { status: 400 });
    }

    const check_in_date =
      typeof b.check_in_date === 'string' ? b.check_in_date.trim() : '';
    if (!check_in_date || !DATE_RE.test(check_in_date)) {
      return NextResponse.json({ error: 'invalidCheckInDate' }, { status: 400 });
    }
    const checkInParsed = new Date(check_in_date + 'T00:00:00Z');
    if (Number.isNaN(checkInParsed.getTime())) {
      return NextResponse.json({ error: 'invalidCheckInDate' }, { status: 400 });
    }

    let check_out_date: string | null = null;
    if (b.check_out_date != null && b.check_out_date !== '') {
      const raw = typeof b.check_out_date === 'string' ? b.check_out_date.trim() : '';
      if (!raw || !DATE_RE.test(raw)) {
        return NextResponse.json({ error: 'invalidCheckOutDate' }, { status: 400 });
      }
      const parsed = new Date(raw + 'T00:00:00Z');
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'invalidCheckOutDate' }, { status: 400 });
      }
      if (parsed.getTime() <= checkInParsed.getTime()) {
        return NextResponse.json({ error: 'invalidCheckOutDate' }, { status: 400 });
      }
      check_out_date = raw;
    }

    // 7. Resident lookup + status gate.
    const { data: resident, error: residentErr } = await supabase
      .from('residents')
      .select('id, full_name, status')
      .eq('id', residentId)
      .maybeSingle<ResidentLookupRow>();
    if (residentErr) {
      console.error('Resident lookup failed:', residentErr);
      return NextResponse.json({ error: 'assignmentCreateFailed' }, { status: 500 });
    }
    if (!resident) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (resident.status === 'checked_out' || resident.status === 'suspended') {
      return NextResponse.json({ error: 'residentNotActive' }, { status: 409 });
    }

    // 8. Resident must not already have an active assignment.
    const { count: existingActiveCount, error: existingActiveErr } = await supabase
      .from('room_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('resident_id', residentId)
      .eq('status', 'active');
    if (existingActiveErr) {
      console.error('Existing active-assignment count failed:', existingActiveErr);
      return NextResponse.json({ error: 'assignmentCreateFailed' }, { status: 500 });
    }
    if ((existingActiveCount ?? 0) >= 1) {
      return NextResponse.json({ error: 'residentAlreadyAssigned' }, { status: 409 });
    }

    // 9. Room lookup.
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('id, building_id, capacity, occupancy_mode, status')
      .eq('id', room_id)
      .maybeSingle<RoomLookupRow>();
    if (roomErr) {
      console.error('Room lookup failed:', roomErr);
      return NextResponse.json({ error: 'assignmentCreateFailed' }, { status: 500 });
    }
    if (!room) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 10. Reject rooms that are out of inventory.
    if (room.status === 'maintenance' || room.status === 'reserved') {
      return NextResponse.json({ error: 'roomUnavailable' }, { status: 409 });
    }

    // 11. Non-admin-tier scope: room.building_id must be in the staff's
    //     assigned buildings. Always uses the destination room's building,
    //     not the resident's prior building.
    if (!hasAdminAccess(profile.role)) {
      const assignedIds = await getAssignedBuildingIds(profile.id);
      if (!assignedIds.includes(room.building_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // 12. Vacancy check using the rules from src/lib/rooms/occupancy.ts.
    const { count: roomActiveCount, error: roomActiveErr } = await supabase
      .from('room_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', room_id)
      .eq('status', 'active');
    if (roomActiveErr) {
      console.error('Room active-assignment count failed:', roomActiveErr);
      return NextResponse.json({ error: 'assignmentCreateFailed' }, { status: 500 });
    }
    const prevActive = roomActiveCount ?? 0;
    const normalizedCapacity = normalizeCapacity(room.capacity);
    const isShared = room.occupancy_mode === 'shared';
    if (!isShared) {
      // private (default): any active assignment fills the room.
      if (prevActive >= 1) {
        return NextResponse.json({ error: 'roomFull' }, { status: 409 });
      }
    } else {
      if (prevActive >= normalizedCapacity) {
        return NextResponse.json({ error: 'roomFull' }, { status: 409 });
      }
    }

    // 13. Insert the assignment. Even though step 8 + step 12 guard against
    //     dup-resident and over-fill in JS, a concurrent move-in to the same
    //     room/resident could slip past those reads. Migration 027 adds two
    //     DB-level safety nets:
    //       - uniq_active_assignment_per_resident (23505) → residentAlreadyAssigned
    //       - enforce_room_capacity() trigger (23514, msg 'room_capacity_exceeded')
    //         → roomFull
    //     Map both to the same 409 codes the JS guards already use so the UI
    //     toast is identical regardless of which check tripped.
    const { data: inserted, error: insertErr } = await supabase
      .from('room_assignments')
      .insert({
        resident_id: residentId,
        room_id,
        building_id: room.building_id,
        check_in_date,
        check_out_date,
        status: 'active',
        created_by: profile.id,
      })
      .select('id')
      .single<AssignmentInsertRow>();
    if (insertErr || !inserted) {
      const code = (insertErr as { code?: string } | null)?.code;
      const message = (insertErr as { message?: string } | null)?.message ?? '';
      if (code === '23505') {
        return NextResponse.json({ error: 'residentAlreadyAssigned' }, { status: 409 });
      }
      if (code === '23514' || message.includes('room_capacity_exceeded')) {
        return NextResponse.json({ error: 'roomFull' }, { status: 409 });
      }
      console.error('Assignment insert failed:', insertErr);
      return NextResponse.json({ error: 'assignmentCreateFailed' }, { status: 500 });
    }
    const assignmentId = inserted.id;

    // 14. Recompute room.status. After this insert, active count is
    //     prevActive + 1. We've already 409'd on maintenance/reserved above,
    //     so we only consider available <-> occupied transitions here.
    const newActive = prevActive + 1;
    let newStatus: RoomLookupRow['status'] = room.status;
    if (isShared) {
      newStatus = newActive >= normalizedCapacity ? 'occupied' : 'available';
    } else {
      // private: any active fills the room.
      newStatus = 'occupied';
    }
    if (newStatus !== room.status) {
      const { error: roomUpdErr } = await supabase
        .from('rooms')
        .update({ status: newStatus })
        .eq('id', room_id);
      if (roomUpdErr) {
        // Race window: assignment is committed but room.status didn't
        // update. Surface in logs for manual reconciliation but do NOT
        // roll back — the assignment row is the source of truth.
        console.error(
          'Room status update failed after assignment insert; manual reconciliation may be needed',
          roomUpdErr
        );
      }
    }

    // 15. Best-effort activity log. Fire-and-forget; do not await.
    void supabase
      .from('activity_log')
      .insert({
        user_id: profile.id,
        action: 'resident.moved_in',
        entity_type: 'resident',
        entity_id: residentId,
        details: {
          assignment_id: assignmentId,
          room_id,
          building_id: room.building_id,
          check_in_date,
          check_out_date,
        },
      })
      .then(({ error: logErr }) => {
        if (logErr) {
          console.error('activity_log insert failed (resident.moved_in):', logErr);
        }
      });

    return NextResponse.json(
      {
        id: assignmentId,
        room_id,
        building_id: room.building_id,
        check_in_date,
        check_out_date,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Resident move-in error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

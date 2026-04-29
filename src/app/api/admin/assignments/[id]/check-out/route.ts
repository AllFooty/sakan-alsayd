import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';
import { normalizeCapacity } from '@/lib/rooms/occupancy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REASON_LEN = 1000;

interface AssignmentRow {
  id: string;
  resident_id: string;
  room_id: string;
  building_id: string;
  check_in_date: string;
  status: 'active' | 'ended';
}

interface RoomStatusRow {
  capacity: number | null;
  occupancy_mode: 'private' | 'shared' | null;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();
  return year >= 2020 && year <= currentYear + 1;
}

// PATCH /api/admin/assignments/[id]/check-out — end an active room_assignment
// and recompute the room's status.
//
// NOTE on atomicity: sequential writes (assignment UPDATE, then room.status
// UPDATE). No transaction; matches the existing booking/maintenance pipeline
// pattern. Race window is tiny and self-heals on the next vacancy recompute.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    if (!UUID_RE.test(assignmentId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const auth = await authenticateApiRequest('branch_manager', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    // Empty body is allowed — both date and reason are optional.
    const body = await request.json().catch(() => null);
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

    let check_out_date: string;
    if (b.check_out_date != null && b.check_out_date !== '') {
      const raw = typeof b.check_out_date === 'string' ? b.check_out_date.trim() : '';
      if (!isValidDate(raw)) {
        return NextResponse.json({ error: 'invalidCheckOutDate' }, { status: 400 });
      }
      check_out_date = raw;
    } else {
      check_out_date = todayISO();
    }

    let reason: string | null = null;
    if (typeof b.reason === 'string') {
      const t = b.reason.trim();
      if (t.length > 0) reason = t.slice(0, MAX_REASON_LEN);
    }

    // Fetch assignment.
    const { data: assignment, error: fetchErr } = await supabase
      .from('room_assignments')
      .select('id, resident_id, room_id, building_id, check_in_date, status')
      .eq('id', assignmentId)
      .maybeSingle<AssignmentRow>();
    if (fetchErr) {
      console.error('Assignment fetch failed:', fetchErr);
      return NextResponse.json({ error: 'checkOutFailed' }, { status: 500 });
    }
    if (!assignment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Non-admin-tier scope (existence-hide via 404).
    if (!hasAdminAccess(profile.role)) {
      const assignedIds = await getAssignedBuildingIds(profile.id);
      if (!assignedIds.includes(assignment.building_id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    // Idempotent: already ended.
    if (assignment.status === 'ended') {
      return NextResponse.json({
        id: assignmentId,
        room_id: assignment.room_id,
        already_ended: true,
      });
    }

    // check_out_date must be on or after check_in_date (string compare works for ISO YYYY-MM-DD).
    if (check_out_date < assignment.check_in_date) {
      return NextResponse.json({ error: 'checkOutBeforeCheckIn' }, { status: 400 });
    }

    // End the assignment.
    const { error: updErr } = await supabase
      .from('room_assignments')
      .update({ status: 'ended', check_out_date })
      .eq('id', assignmentId);
    if (updErr) {
      console.error('Assignment check-out failed:', updErr);
      return NextResponse.json({ error: 'checkOutFailed' }, { status: 500 });
    }

    // Recompute the room's status. Maintenance/reserved is admin-overridden;
    // never flip it via assignment ops.
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('capacity, occupancy_mode, status')
      .eq('id', assignment.room_id)
      .maybeSingle<RoomStatusRow>();
    if (roomErr) {
      console.error('Room fetch after check-out failed:', roomErr);
    } else if (
      room &&
      room.status !== 'maintenance' &&
      room.status !== 'reserved'
    ) {
      const { count: remainingActive, error: cntErr } = await supabase
        .from('room_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', assignment.room_id)
        .eq('status', 'active');
      if (cntErr) {
        console.error('Room active count after check-out failed:', cntErr);
      } else {
        const active = remainingActive ?? 0;
        const capacity = normalizeCapacity(room.capacity);
        const isShared = room.occupancy_mode === 'shared';
        const newStatus: RoomStatusRow['status'] =
          active === 0
            ? 'available'
            : isShared && active >= capacity
              ? 'occupied'
              : isShared
                ? 'available'
                : 'occupied'; // private with any active = occupied
        if (newStatus !== room.status) {
          const { error: roomUpdErr } = await supabase
            .from('rooms')
            .update({ status: newStatus })
            .eq('id', assignment.room_id);
          if (roomUpdErr) {
            // Race window: assignment is ended but room status didn't flip.
            // Logged for reconciliation; the next vacancy recompute self-heals.
            console.error(
              'Room status update failed after check-out; manual reconciliation may be needed',
              roomUpdErr
            );
          }
        }
      }
    }

    // Best-effort activity log.
    void supabase
      .from('activity_log')
      .insert({
        user_id: profile.id,
        action: 'resident.checked_out_assignment',
        entity_type: 'room_assignment',
        entity_id: assignmentId,
        details: {
          resident_id: assignment.resident_id,
          room_id: assignment.room_id,
          building_id: assignment.building_id,
          check_out_date,
          reason,
        },
      })
      .then(({ error: logErr }) => {
        if (logErr) {
          console.error(
            'activity_log insert failed (resident.checked_out_assignment):',
            logErr
          );
        }
      });

    return NextResponse.json({
      id: assignmentId,
      room_id: assignment.room_id,
      check_out_date,
    });
  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

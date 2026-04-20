import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { BOOKING_TRANSITIONS, canTransition } from '@/lib/pipeline/transitions';

const VALID_BOOKING_STATUSES = ['new', 'in_review', 'pending_payment', 'pending_onboarding', 'completed', 'rejected', 'cancelled'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest('branch_manager', 'finance_staff', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const { id } = await params;

    const { data, error } = await supabase
      .from('booking_requests')
      .select('*, assigned_staff:staff_profiles!booking_requests_assigned_to_fkey(id, full_name)')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Booking request not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest('branch_manager', 'finance_staff', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { user, profile, supabase } = auth;

    const { id } = await params;
    const body = await request.json();
    const { status, assigned_to, notes } = body;

    if (status && !VALID_BOOKING_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_BOOKING_STATUSES.join(', ')}` }, { status: 400 });
    }

    // Fetch current booking to detect status change
    let oldStatus: string | null = null;
    if (status) {
      const { data: current } = await supabase
        .from('booking_requests')
        .select('status')
        .eq('id', id)
        .single();
      if (!current) {
        return NextResponse.json({ error: 'Booking request not found' }, { status: 404 });
      }
      oldStatus = current.status;

      // Enforce forward-only pipeline transitions. super_admin can override.
      if (profile.role !== 'super_admin' && !canTransition(BOOKING_TRANSITIONS, oldStatus, status)) {
        const allowed = BOOKING_TRANSITIONS[oldStatus ?? ''] ?? [];
        return NextResponse.json(
          {
            error: `Invalid transition: ${oldStatus} → ${status}. Allowed from ${oldStatus}: ${allowed.length ? allowed.join(', ') : '(none — terminal state)'}.`,
          },
          { status: 400 },
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase
      .from('booking_requests')
      .update(updates)
      .eq('id', id)
      .select('*, assigned_staff:staff_profiles!booking_requests_assigned_to_fkey(id, full_name)')
      .single();

    if (error) {
      console.error('Error updating booking request:', error);
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }

    // Auto-log status change as a system note
    if (status && oldStatus && status !== oldStatus) {
      await supabase.from('booking_request_notes').insert({
        booking_request_id: id,
        author_id: user.id,
        note: `[system] Status changed: ${oldStatus} → ${status}`,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Update booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    if (profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from('booking_requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting booking request:', error);
      return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete booking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

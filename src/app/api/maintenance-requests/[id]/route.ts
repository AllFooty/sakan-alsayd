import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { MAINTENANCE_TRANSITIONS, canTransition } from '@/lib/pipeline/transitions';

const VALID_MAINTENANCE_STATUSES = ['submitted', 'assigned', 'in_progress', 'completed', 'rejected', 'cancelled'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest('branch_manager', 'maintenance_staff', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const { id } = await params;

    const { data, error } = await supabase
      .from('maintenance_requests')
      .select(
        '*, building:buildings!maintenance_requests_building_id_fkey(id, slug, neighborhood_en, neighborhood_ar, city_en, city_ar), assigned_staff:staff_profiles!maintenance_requests_assigned_to_fkey(id, full_name)'
      )
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get maintenance request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest('branch_manager', 'maintenance_staff', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { user, profile, supabase } = auth;

    const { id } = await params;
    const body = await request.json();
    const { status, priority, assigned_to, resolution_notes, category } = body;

    if (status && !VALID_MAINTENANCE_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_MAINTENANCE_STATUSES.join(', ')}` }, { status: 400 });
    }

    // Fetch current request to detect status change
    let oldStatus: string | null = null;
    if (status) {
      const { data: current } = await supabase
        .from('maintenance_requests')
        .select('status')
        .eq('id', id)
        .single();
      if (!current) {
        return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });
      }
      oldStatus = current.status;

      // Enforce forward-only pipeline transitions. super_admin can override.
      if (profile.role !== 'super_admin' && !canTransition(MAINTENANCE_TRANSITIONS, oldStatus, status)) {
        const allowed = MAINTENANCE_TRANSITIONS[oldStatus ?? ''] ?? [];
        return NextResponse.json(
          {
            error: `Invalid transition: ${oldStatus} → ${status}. Allowed from ${oldStatus}: ${allowed.length ? allowed.join(', ') : '(none — terminal state)'}.`,
          },
          { status: 400 },
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (status) {
      updates.status = status;
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
    }
    if (priority) updates.priority = priority;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
    if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;
    if (category) updates.category = category;
    if (body.photos !== undefined) updates.photos = body.photos;

    const { data, error } = await supabase
      .from('maintenance_requests')
      .update(updates)
      .eq('id', id)
      .select(
        '*, building:buildings!maintenance_requests_building_id_fkey(id, slug, neighborhood_en, neighborhood_ar, city_en, city_ar), assigned_staff:staff_profiles!maintenance_requests_assigned_to_fkey(id, full_name)'
      )
      .single();

    if (error) {
      console.error('Error updating maintenance request:', error);
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }

    // Auto-log status change as a system note
    if (status && oldStatus && status !== oldStatus) {
      await supabase.from('maintenance_request_notes').insert({
        maintenance_request_id: id,
        author_id: user.id,
        note: `[system] Status changed: ${oldStatus} → ${status}`,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Update maintenance request error:', error);
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
      return NextResponse.json({ error: 'Forbidden: super_admin only' }, { status: 403 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from('maintenance_requests')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting maintenance request:', error);
      return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete maintenance request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

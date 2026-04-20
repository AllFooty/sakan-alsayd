import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { MAINTENANCE_TRANSITIONS, canTransition } from '@/lib/pipeline/transitions';

const VALID_STATUSES = ['submitted', 'assigned', 'in_progress', 'completed', 'rejected', 'cancelled'];

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest('branch_manager', 'maintenance_staff', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { user, profile, supabase } = auth;

    const body = await request.json();
    const { ids, status } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required and must be non-empty' }, { status: 400 });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    // Validate every row can transition to the target status. super_admin can override.
    if (profile.role !== 'super_admin') {
      const { data: current, error: fetchError } = await supabase
        .from('maintenance_requests')
        .select('id, status')
        .in('id', ids);

      if (fetchError) {
        console.error('Bulk maintenance status precheck error:', fetchError);
        return NextResponse.json({ error: 'Failed to validate transitions' }, { status: 500 });
      }
      if (!current || current.length !== ids.length) {
        return NextResponse.json({ error: 'One or more maintenance requests not found' }, { status: 404 });
      }

      const invalid = current.filter((row) => !canTransition(MAINTENANCE_TRANSITIONS, row.status, status));
      if (invalid.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid transition for ${invalid.length} record(s). Allowed next states differ per current status.`,
            invalid: invalid.map((row) => ({ id: row.id, from: row.status, to: status })),
          },
          { status: 400 },
        );
      }
    }

    const updates: Record<string, unknown> = { status };
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('maintenance_requests')
      .update(updates)
      .in('id', ids)
      .select('id');

    if (error) {
      console.error('Bulk update maintenance requests error:', error);
      return NextResponse.json({ error: 'Failed to update requests' }, { status: 500 });
    }

    // Log system notes for each updated record
    const notes = ids.map((id: string) => ({
      maintenance_request_id: id,
      author_id: user.id,
      note: `[system] Bulk status change → ${status}`,
    }));
    await supabase.from('maintenance_request_notes').insert(notes);

    return NextResponse.json({ updated: data?.length || 0 });
  } catch (error) {
    console.error('Bulk update maintenance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    if (profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required and must be non-empty' }, { status: 400 });
    }

    const { error } = await supabase
      .from('maintenance_requests')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Bulk delete maintenance requests error:', error);
      return NextResponse.json({ error: 'Failed to delete requests' }, { status: 500 });
    }

    return NextResponse.json({ deleted: ids.length });
  } catch (error) {
    console.error('Bulk delete maintenance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

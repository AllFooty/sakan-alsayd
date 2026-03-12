import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const { id } = await params;

    const { data, error } = await supabase
      .from('maintenance_request_notes')
      .select('*, author:staff_profiles!maintenance_request_notes_author_id_fkey(id, full_name)')
      .eq('maintenance_request_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching maintenance notes:', error);
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Fetch maintenance notes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    const { user, supabase } = auth;

    const { id } = await params;
    const body = await request.json();
    const { note } = body;

    if (!note || note.trim().length === 0) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('maintenance_request_notes')
      .insert({
        maintenance_request_id: id,
        author_id: user.id,
        note: note.trim(),
      })
      .select('*, author:staff_profiles!maintenance_request_notes_author_id_fkey(id, full_name)')
      .single();

    if (error) {
      console.error('Error creating maintenance note:', error);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Create maintenance note error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

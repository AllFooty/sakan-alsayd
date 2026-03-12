import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    let query = supabase
      .from('staff_profiles')
      .select('id, full_name, role')
      .eq('is_active', true);

    if (role) {
      query = query.eq('role', role);
    }

    const { data, error } = await query.order('full_name');

    if (error) {
      console.error('Error fetching staff:', error);
      return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Staff fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

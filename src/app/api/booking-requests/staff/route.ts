import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(
      'branch_manager',
      'finance_staff',
      'finance_manager',
      'supervision_staff'
    );
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    let query = supabase
      .from('staff_profiles')
      .select('id, full_name, role')
      .eq('is_active', true);

    if (role) {
      // Accept a comma-separated role list so callers can include manager peers
      // alongside their staff counterparts (e.g. finance_staff,finance_manager).
      const roles = role.split(',').map((r) => r.trim()).filter(Boolean);
      if (roles.length === 1) query = query.eq('role', roles[0]);
      else if (roles.length > 1) query = query.in('role', roles);
    }

    const { data, error } = await query.order('full_name');

    if (error) {
      console.error('Error fetching staff:', error);
      return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
    }

    const response = NextResponse.json(data);
    // Staff list changes rarely — cache for 2 minutes, serve stale up to 5 min
    response.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=300');
    return response;
  } catch (error) {
    console.error('Staff fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

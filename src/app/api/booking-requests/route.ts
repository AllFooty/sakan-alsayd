import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const isExport = searchParams.get('export') === 'true';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('booking_requests')
      .select('*, assigned_staff:staff_profiles!booking_requests_assigned_to_fkey(id, full_name)', { count: 'exact' });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false });

    if (!isExport) {
      query = query.range(offset, offset + limit - 1);
    } else {
      query = query.limit(10000);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching booking requests:', error);
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Booking requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

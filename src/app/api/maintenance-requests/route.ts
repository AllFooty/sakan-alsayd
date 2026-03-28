import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const buildingId = searchParams.get('building_id');
    const assignedTo = searchParams.get('assigned_to');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const isExport = searchParams.get('export') === 'true';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('maintenance_requests')
      .select(
        '*, building:buildings!maintenance_requests_building_id_fkey(id, slug, neighborhood_en, neighborhood_ar, city_en, city_ar), assigned_staff:staff_profiles!maintenance_requests_assigned_to_fkey(id, full_name)',
        { count: 'exact' }
      );

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,requester_name.ilike.%${search}%,requester_phone.ilike.%${search}%,description.ilike.%${search}%,room_number.ilike.%${search}%`);
    }

    if (buildingId) {
      query = query.eq('building_id', buildingId);
    }

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);
    }

    query = query.order('created_at', { ascending: false });

    if (!isExport) {
      query = query.range(offset, offset + limit - 1);
    } else {
      query = query.limit(10000);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching maintenance requests:', error);
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Maintenance requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

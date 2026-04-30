import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

const MAX_SEARCH_LEN = 100;
const SEARCH_STRIP_RE = /[,()*"\\]/g;

function safeInt(val: string | null, fallback: number): number {
  const parsed = parseInt(val || String(fallback));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function isValidDate(val: string): boolean {
  return !isNaN(new Date(val).getTime());
}

function sanitizeSearch(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.slice(0, MAX_SEARCH_LEN).replace(SEARCH_STRIP_RE, '');
  return trimmed.trim() || null;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(
      'branch_manager',
      'maintenance_staff',
      'maintenance_manager',
      'supervision_staff'
    );
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');
    const search = sanitizeSearch(searchParams.get('search'));
    const buildingId = searchParams.get('building_id');
    const assignedTo = searchParams.get('assigned_to');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const isExport = searchParams.get('export') === 'true';
    // `apartment_shared=1` returns only requests with no specific room
    // (shared-area issues — kitchen/hallway/AC). The apartment_id is optional
    // because the public modal lets the requester leave the apartment hint
    // blank when they can't identify it; we still need to surface those for
    // triage instead of dropping them into an unfilterable bucket.
    const apartmentShared = searchParams.get('apartment_shared') === '1';
    const limit = Math.min(Math.max(safeInt(searchParams.get('limit'), 20), 1), 100);
    const page = Math.max(safeInt(searchParams.get('page'), 1), 1);
    const offset = (page - 1) * limit;

    if (
      isExport &&
      !['super_admin', 'deputy_general_manager', 'branch_manager', 'maintenance_manager'].includes(
        profile.role
      )
    ) {
      return NextResponse.json({ error: 'Forbidden: insufficient role for export' }, { status: 403 });
    }

    let query = supabase
      .from('maintenance_requests')
      .select(
        '*, building:buildings!maintenance_requests_building_id_fkey(id, slug, neighborhood_en, neighborhood_ar, city_en, city_ar), apartment:apartments!apartment_id(id, apartment_number, floor), assigned_staff:staff_profiles!maintenance_requests_assigned_to_fkey(id, full_name)',
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
      query = query.or(`description.ilike.%${search}%,extra_details.ilike.%${search}%,requester_name.ilike.%${search}%,requester_phone.ilike.%${search}%,room_number.ilike.%${search}%`);
    }

    if (buildingId) {
      query = query.eq('building_id', buildingId);
    }

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    if (apartmentShared) {
      query = query.is('room_id', null);
    }

    if (dateFrom && isValidDate(dateFrom)) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo && isValidDate(dateTo)) {
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

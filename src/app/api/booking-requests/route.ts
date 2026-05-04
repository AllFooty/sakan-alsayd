import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

// All current values of the booking_status enum. Mirrors the union from
// 001_schema.sql + 004_booking_pipeline.sql. Used to validate `?status=`
// before forwarding to PostgREST, so an unknown value returns a clean 400
// instead of a 500 + leaked enum constraint message.
const BOOKING_STATUSES = new Set([
  'new',
  'contacted',
  'confirmed',
  'rejected',
  'in_review',
  'pending_payment',
  'pending_onboarding',
  'completed',
  'cancelled',
]);

const MAX_SEARCH_LEN = 100;
// Strip characters that have special meaning in PostgREST .or() / ilike filters.
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
      'finance_staff',
      'finance_manager',
      'supervision_staff',
      'maintenance_manager'
    );
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = sanitizeSearch(searchParams.get('search'));
    const city = sanitizeSearch(searchParams.get('city'));
    const assignedTo = searchParams.get('assigned_to');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const isExport = searchParams.get('export') === 'true';
    const limit = Math.min(Math.max(safeInt(searchParams.get('limit'), 20), 1), 100);
    const page = Math.max(safeInt(searchParams.get('page'), 1), 1);
    const offset = (page - 1) * limit;

    // Sort: allowlist guards against arbitrary column injection. Default
    // matches the historical fixed order so callers without ?sort= are
    // unaffected. `status` is intentionally NOT sortable: booking_status
    // was extended via ALTER TYPE ADD VALUE in 004 so its declaration
    // order is `new, contacted, confirmed, rejected, in_review,
    // pending_payment, pending_onboarding, completed, cancelled`. Postgres
    // sorts enums by declaration order, which interleaves rejected before
    // in_review/completed and produces a meaningless lifecycle order.
    // Filter tabs cover this dimension instead.
    const SORTABLE = new Set(['created_at', 'name']);
    const rawSort = searchParams.get('sort');
    const sortColumn = rawSort && SORTABLE.has(rawSort) ? rawSort : 'created_at';
    const sortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

    if (
      isExport &&
      !['super_admin', 'deputy_general_manager', 'branch_manager', 'finance_manager'].includes(
        profile.role
      )
    ) {
      return NextResponse.json({ error: 'Forbidden: insufficient role for export' }, { status: 403 });
    }

    let query = supabase
      .from('booking_requests')
      .select('*, assigned_staff:staff_profiles!booking_requests_assigned_to_fkey(id, full_name)', { count: 'exact' });

    if (status && status !== 'all') {
      if (!BOOKING_STATUSES.has(status)) {
        return NextResponse.json({ error: 'invalidStatus' }, { status: 400 });
      }
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,city_interested.ilike.%${search}%,message.ilike.%${search}%`);
    }

    if (city) {
      query = query.ilike('city_interested', `%${city}%`);
    }

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    if (dateFrom && isValidDate(dateFrom)) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo && isValidDate(dateTo)) {
      query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);
    }

    query = query.order(sortColumn, { ascending: sortDir === 'asc' });
    // Stable secondary order so equal primary keys don't shuffle between pages.
    if (sortColumn !== 'created_at') {
      query = query.order('created_at', { ascending: false });
    }

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

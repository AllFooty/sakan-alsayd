import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

const VALID_RANGES = new Set(['7', '30', '90']);

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest('branch_manager');
  if (isAuthError(auth)) return auth;

  const { supabase } = auth;

  const rawRange = new URL(request.url).searchParams.get('range') ?? '30';
  const range = VALID_RANGES.has(rawRange) ? rawRange : '30';
  const fromIso = new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
  const toIso = new Date().toISOString();

  const { data, error } = await supabase.rpc('dashboard_counters', {
    p_from: fromIso,
    p_to: toIso,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;

  const response = NextResponse.json({
    newBookings: Number(row?.new_bookings ?? 0),
    openMaintenance: Number(row?.open_maintenance ?? 0),
    totalBuildings: Number(row?.total_buildings ?? 0),
    activeResidents: Number(row?.active_residents ?? 0),
    range,
  });
  response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
  return response;
}

import { NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

export async function GET() {
  const auth = await authenticateApiRequest('branch_manager');
  if (isAuthError(auth)) return auth;

  const { supabase } = auth;

  const { data, error } = await supabase.rpc('dashboard_counters');
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  // rpc returns an array with a single row; bigints come back as string|number
  const row = Array.isArray(data) ? data[0] : data;

  const response = NextResponse.json({
    newBookings: Number(row?.new_bookings ?? 0),
    openMaintenance: Number(row?.open_maintenance ?? 0),
    totalBuildings: Number(row?.total_buildings ?? 0),
    activeResidents: Number(row?.active_residents ?? 0),
  });
  // Dashboard stats can be slightly stale — cache for 30 seconds
  response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
  return response;
}

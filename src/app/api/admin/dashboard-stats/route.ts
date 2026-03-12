import { NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

export async function GET() {
  const auth = await authenticateApiRequest();
  if (isAuthError(auth)) return auth;

  const { supabase } = auth;

  const [newBookings, openMaintenance, totalBuildings, activeResidents] = await Promise.all([
    supabase.from('booking_requests').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('maintenance_requests').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'assigned', 'in_progress']),
    supabase.from('buildings').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('residents').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ]);

  return NextResponse.json({
    newBookings: newBookings.count ?? 0,
    openMaintenance: openMaintenance.count ?? 0,
    totalBuildings: totalBuildings.count ?? 0,
    activeResidents: activeResidents.count ?? 0,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ApartmentSummaryRow {
  id: string;
  building_id: string;
}

interface ApartmentRoomIdRow {
  id: string;
}

interface ApartmentMateRow {
  id: string;
  room_id: string;
  resident_id: string;
  check_in_date: string;
  status: 'active' | 'ended';
  rooms: { room_number: string | null } | null;
  resident: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    nationality: string | null;
    profile_image: string | null;
    status: string;
  } | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const auth = await authenticateApiRequest(
      'branch_manager',
      'maintenance_manager',
      'transportation_manager',
      'finance_manager',
      'maintenance_staff',
      'transportation_staff',
      'supervision_staff',
      'finance_staff'
    );
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    const { data: apartment, error: aptErr } = await supabase
      .from('apartments')
      .select('id, building_id')
      .eq('id', id)
      .maybeSingle<ApartmentSummaryRow>();

    if (aptErr) {
      console.error('Apartment lookup failed:', aptErr);
      return NextResponse.json({ error: 'Failed to fetch residents' }, { status: 500 });
    }
    if (!apartment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!hasAdminAccess(profile.role)) {
      const assignedIds = await getAssignedBuildingIds(profile.id);
      if (!assignedIds.includes(apartment.building_id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    // Fetch room IDs in this apartment, then resolve their active assignments
    // with embedded resident info. Two round-trips, but each is small and the
    // join keeps the UI side simple.
    const { data: rooms, error: roomsErr } = await supabase
      .from('rooms')
      .select('id')
      .eq('apartment_id', id)
      .returns<ApartmentRoomIdRow[]>();

    if (roomsErr) {
      console.error('Apartment rooms lookup failed:', roomsErr);
      return NextResponse.json({ error: 'Failed to fetch residents' }, { status: 500 });
    }

    const roomIds = (rooms ?? []).map((r) => r.id);
    if (roomIds.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }

    const { data, error } = await supabase
      .from('room_assignments')
      .select(
        `
        id, room_id, resident_id, check_in_date, status,
        rooms(room_number),
        resident:residents(id, full_name, phone, email, nationality, profile_image, status)
        `
      )
      .eq('status', 'active')
      .in('room_id', roomIds)
      .order('check_in_date', { ascending: false })
      .returns<ApartmentMateRow[]>();

    if (error) {
      console.error('Apartment residents fetch failed:', error);
      return NextResponse.json({ error: 'Failed to fetch residents' }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [], total: data?.length ?? 0 });
  } catch (error) {
    console.error('Apartment residents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

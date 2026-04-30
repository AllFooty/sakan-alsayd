import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';
import { revalidatePublicBuildings } from '@/lib/buildings/public';
import type { Apartment } from '@/lib/apartments/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ApartmentRow = Apartment;

interface BuildingSummaryRow {
  id: string;
  slug: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
}

interface ApartmentRoomRow {
  id: string;
  room_number: string | null;
  floor: number | null;
  room_type: string;
  bathroom_type: string;
  capacity: number;
  occupancy_mode: 'private' | 'shared';
  monthly_price: number;
  discounted_price: number | null;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

interface ApartmentAssignmentRow {
  id: string;
  room_id: string;
  resident_id: string;
  check_in_date: string;
  status: 'active' | 'ended';
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
      .select(
        'id, building_id, apartment_number, floor, description_en, description_ar, notes, has_kitchen, has_living_room, shared_bathroom_count, private_bathroom_count, is_active, sort_order, created_at, updated_at'
      )
      .eq('id', id)
      .maybeSingle<ApartmentRow>();

    if (aptErr) {
      console.error('Error fetching apartment:', aptErr);
      return NextResponse.json({ error: 'Failed to fetch apartment' }, { status: 500 });
    }
    if (!apartment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Scope: non-admin-tier roles only see apartments in their assigned
    // buildings. 404 (not 403) so we don't leak existence.
    if (!hasAdminAccess(profile.role)) {
      const assignedIds = await getAssignedBuildingIds(profile.id);
      if (!assignedIds.includes(apartment.building_id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    // Fetch rooms first because the active-assignments query needs the
    // room IDs. Rooms is one query — the building summary parallelizes
    // with it cheaply.
    const [buildingRes, roomsRes] = await Promise.all([
      supabase
        .from('buildings')
        .select('id, slug, city_en, city_ar, neighborhood_en, neighborhood_ar')
        .eq('id', apartment.building_id)
        .maybeSingle<BuildingSummaryRow>(),
      supabase
        .from('rooms')
        .select(
          'id, room_number, floor, room_type, bathroom_type, capacity, occupancy_mode, monthly_price, discounted_price, status'
        )
        .eq('apartment_id', id)
        .order('room_number', { ascending: true, nullsFirst: false })
        .returns<ApartmentRoomRow[]>(),
    ]);

    if (buildingRes.error) {
      console.error('Error fetching building summary:', buildingRes.error);
    }
    if (roomsRes.error) {
      console.error('Error fetching apartment rooms:', roomsRes.error);
    }

    const rooms = roomsRes.data ?? [];
    const roomIds = rooms.map((r) => r.id);

    let activeAssignments: ApartmentAssignmentRow[] = [];
    if (roomIds.length > 0) {
      const { data: assignsData, error: assignsErr } = await supabase
        .from('room_assignments')
        .select(
          `
          id, room_id, resident_id, check_in_date, status,
          resident:residents(id, full_name, phone, email, nationality, profile_image, status)
        `
        )
        .eq('status', 'active')
        .in('room_id', roomIds)
        .returns<ApartmentAssignmentRow[]>();
      if (assignsErr) {
        console.error('Error fetching apartment assignments:', assignsErr);
      } else {
        activeAssignments = assignsData ?? [];
      }
    }

    const stats = {
      rooms_count: rooms.length,
      total_capacity: rooms.reduce((acc, r) => acc + (r.capacity ?? 0), 0),
      active_residents_count: activeAssignments.length,
    };

    return NextResponse.json({
      data: {
        ...apartment,
        building: buildingRes.data ?? null,
        rooms,
        active_assignments: activeAssignments,
        stats,
      },
    });
  } catch (error) {
    console.error('Apartment detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- PATCH: edit an apartment -----

const MAX_APT_NUMBER = 50;
const MAX_DESC = 5000;
const MAX_NOTES = 5000;
const MIN_FLOOR = -10;
const MAX_FLOOR = 200;
const MIN_BATHROOMS = 0;
const MAX_BATHROOMS = 20;

function trimStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function isFiniteInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const auth = await authenticateApiRequest('branch_manager');
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    const { data: existing, error: fetchErr } = await supabase
      .from('apartments')
      .select(
        'id, building_id, building:buildings!building_id(is_active)'
      )
      .eq('id', id)
      .maybeSingle<{
        id: string;
        building_id: string;
        building: { is_active: boolean } | null;
      }>();
    if (fetchErr) {
      console.error('Apartment lookup failed:', fetchErr);
      return NextResponse.json({ error: 'updateFailed' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!hasAdminAccess(profile.role)) {
      const assignedIds = await getAssignedBuildingIds(profile.id);
      if (!assignedIds.includes(existing.building_id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    if (existing.building && !existing.building.is_active) {
      return NextResponse.json({ error: 'buildingInactive' }, { status: 409 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    const updates: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(b, 'apartment_number')) {
      const v = trimStr(b.apartment_number, MAX_APT_NUMBER);
      if (!v) {
        return NextResponse.json({ error: 'apartmentNumberRequired' }, { status: 400 });
      }
      updates.apartment_number = v;
    }

    if (Object.prototype.hasOwnProperty.call(b, 'floor')) {
      if (!isFiniteInt(b.floor) || (b.floor as number) < MIN_FLOOR || (b.floor as number) > MAX_FLOOR) {
        return NextResponse.json({ error: 'invalidFloor' }, { status: 400 });
      }
      updates.floor = b.floor;
    }

    for (const k of ['description_en', 'description_ar'] as const) {
      if (Object.prototype.hasOwnProperty.call(b, k)) {
        updates[k] = trimStr(b[k], MAX_DESC) ?? '';
      }
    }

    if (Object.prototype.hasOwnProperty.call(b, 'notes')) {
      const v = b.notes;
      updates.notes = v === null || v === '' ? null : trimStr(v, MAX_NOTES);
    }

    if (Object.prototype.hasOwnProperty.call(b, 'has_kitchen')) {
      updates.has_kitchen = b.has_kitchen === true;
    }
    if (Object.prototype.hasOwnProperty.call(b, 'has_living_room')) {
      updates.has_living_room = b.has_living_room === true;
    }

    for (const k of ['shared_bathroom_count', 'private_bathroom_count'] as const) {
      if (Object.prototype.hasOwnProperty.call(b, k)) {
        const v = b[k];
        if (!isFiniteInt(v) || (v as number) < MIN_BATHROOMS || (v as number) > MAX_BATHROOMS) {
          return NextResponse.json({ error: 'invalidBathroomCount' }, { status: 400 });
        }
        updates[k] = v;
      }
    }

    if (Object.prototype.hasOwnProperty.call(b, 'sort_order')) {
      if (!isFiniteInt(b.sort_order)) {
        return NextResponse.json({ error: 'invalidSortOrder' }, { status: 400 });
      }
      updates.sort_order = b.sort_order;
    }

    if (Object.prototype.hasOwnProperty.call(b, 'is_active')) {
      // is_active toggles are admin-tier only — mirrors buildings policy.
      if (!hasAdminAccess(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      updates.is_active = b.is_active === true;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'noChanges' }, { status: 400 });
    }

    const { error: updErr } = await supabase
      .from('apartments')
      .update(updates)
      .eq('id', id);
    if (updErr) {
      if ((updErr as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'apartmentNumberTaken' }, { status: 409 });
      }
      console.error('Apartment update failed:', updErr);
      return NextResponse.json({ error: 'updateFailed' }, { status: 500 });
    }

    revalidatePublicBuildings();
    return NextResponse.json({ id });
  } catch (error) {
    console.error('Apartment update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- DELETE: hard-delete an apartment -----
// FK rooms.apartment_id → apartments.id is ON DELETE RESTRICT, so any
// apartment with rooms in it returns Postgres 23503. Surfaced as
// `apartmentHasRooms` so the form can tell the admin to move/delete the
// rooms first or mark the apartment inactive instead.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    if (!hasAdminAccess(auth.profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { supabase } = auth;

    const { data: existing, error: fetchErr } = await supabase
      .from('apartments')
      .select('id')
      .eq('id', id)
      .maybeSingle<{ id: string }>();
    if (fetchErr) {
      console.error('Apartment lookup failed:', fetchErr);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { error: delErr } = await supabase.from('apartments').delete().eq('id', id);
    if (delErr) {
      if ((delErr as { code?: string }).code === '23503') {
        return NextResponse.json({ error: 'apartmentHasRooms' }, { status: 409 });
      }
      console.error('Apartment delete failed:', delErr);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }

    revalidatePublicBuildings();
    return NextResponse.json({ id });
  } catch (error) {
    console.error('Apartment delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

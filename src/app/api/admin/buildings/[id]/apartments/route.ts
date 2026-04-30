import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';
import { revalidatePublicBuildings } from '@/lib/buildings/public';
import type { Apartment, ApartmentListItem } from '@/lib/apartments/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ApartmentRow = Apartment;

interface RoomApartmentRow {
  id: string;
  apartment_id: string;
}

interface AssignmentApartmentRow {
  room_id: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: buildingId } = await params;
    if (!UUID_RE.test(buildingId)) {
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

    if (!hasAdminAccess(profile.role)) {
      const assignedIds = await getAssignedBuildingIds(profile.id);
      if (!assignedIds.includes(buildingId)) {
        return NextResponse.json({ data: [], total: 0 });
      }
    }

    // Run apartments + rooms + active assignments in parallel and roll up
    // counts client-side. Pulling apartment_id off rooms/assignments keeps
    // the queries simple and the aggregation predictable.
    const [aptsRes, roomsRes, assignsRes] = await Promise.all([
      supabase
        .from('apartments')
        .select(
          'id, building_id, apartment_number, floor, description_en, description_ar, notes, has_kitchen, has_living_room, shared_bathroom_count, private_bathroom_count, is_active, sort_order, created_at, updated_at'
        )
        .eq('building_id', buildingId)
        .order('floor', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('apartment_number', { ascending: true })
        .returns<ApartmentRow[]>(),
      supabase
        .from('rooms')
        .select('id, apartment_id')
        .eq('building_id', buildingId)
        .returns<RoomApartmentRow[]>(),
      supabase
        .from('room_assignments')
        .select('room_id')
        .eq('building_id', buildingId)
        .eq('status', 'active')
        .returns<AssignmentApartmentRow[]>(),
    ]);

    if (aptsRes.error) {
      console.error('Error fetching apartments:', aptsRes.error);
      return NextResponse.json({ error: 'Failed to fetch apartments' }, { status: 500 });
    }
    if (roomsRes.error) {
      console.error('Error fetching rooms for apartments:', roomsRes.error);
      return NextResponse.json({ error: 'Failed to fetch apartments' }, { status: 500 });
    }
    if (assignsRes.error) {
      console.error('Error fetching assignments for apartments:', assignsRes.error);
      return NextResponse.json({ error: 'Failed to fetch apartments' }, { status: 500 });
    }

    const apartments = aptsRes.data ?? [];
    const rooms = roomsRes.data ?? [];
    const activeAssignments = assignsRes.data ?? [];

    const roomsByApartment = new Map<string, number>();
    const apartmentByRoom = new Map<string, string>();
    for (const r of rooms) {
      roomsByApartment.set(r.apartment_id, (roomsByApartment.get(r.apartment_id) ?? 0) + 1);
      apartmentByRoom.set(r.id, r.apartment_id);
    }

    const residentsByApartment = new Map<string, number>();
    for (const a of activeAssignments) {
      const aptId = apartmentByRoom.get(a.room_id);
      if (!aptId) continue;
      residentsByApartment.set(aptId, (residentsByApartment.get(aptId) ?? 0) + 1);
    }

    const data: ApartmentListItem[] = apartments.map((apt) => ({
      ...apt,
      rooms_count: roomsByApartment.get(apt.id) ?? 0,
      active_residents_count: residentsByApartment.get(apt.id) ?? 0,
    }));

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    console.error('Apartments list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- POST: create an apartment in a building -----

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

interface ApartmentInsert {
  building_id: string;
  apartment_number: string;
  floor: number;
  description_en: string;
  description_ar: string;
  notes: string | null;
  has_kitchen: boolean;
  has_living_room: boolean;
  shared_bathroom_count: number;
  private_bathroom_count: number;
  is_active: boolean;
  sort_order: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: buildingId } = await params;
    if (!UUID_RE.test(buildingId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    if (!hasAdminAccess(auth.profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { supabase } = auth;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    const apartment_number = trimStr(b.apartment_number, MAX_APT_NUMBER);
    if (!apartment_number) {
      return NextResponse.json({ error: 'apartmentNumberRequired' }, { status: 400 });
    }

    if (!isFiniteInt(b.floor) || b.floor < MIN_FLOOR || b.floor > MAX_FLOOR) {
      return NextResponse.json({ error: 'invalidFloor' }, { status: 400 });
    }
    const floor = b.floor;

    let shared_bathroom_count = 1;
    if (b.shared_bathroom_count !== undefined && b.shared_bathroom_count !== null) {
      if (
        !isFiniteInt(b.shared_bathroom_count) ||
        b.shared_bathroom_count < MIN_BATHROOMS ||
        b.shared_bathroom_count > MAX_BATHROOMS
      ) {
        return NextResponse.json({ error: 'invalidBathroomCount' }, { status: 400 });
      }
      shared_bathroom_count = b.shared_bathroom_count;
    }

    let private_bathroom_count = 0;
    if (b.private_bathroom_count !== undefined && b.private_bathroom_count !== null) {
      if (
        !isFiniteInt(b.private_bathroom_count) ||
        b.private_bathroom_count < MIN_BATHROOMS ||
        b.private_bathroom_count > MAX_BATHROOMS
      ) {
        return NextResponse.json({ error: 'invalidBathroomCount' }, { status: 400 });
      }
      private_bathroom_count = b.private_bathroom_count;
    }

    let sort_order = floor;
    if (b.sort_order !== undefined && b.sort_order !== null) {
      if (!isFiniteInt(b.sort_order)) {
        return NextResponse.json({ error: 'invalidSortOrder' }, { status: 400 });
      }
      sort_order = b.sort_order;
    }

    // Verify the building exists and is active before insert.
    const { data: building, error: bldgErr } = await supabase
      .from('buildings')
      .select('id, is_active')
      .eq('id', buildingId)
      .maybeSingle<{ id: string; is_active: boolean }>();
    if (bldgErr) {
      console.error('Building lookup failed:', bldgErr);
      return NextResponse.json({ error: 'createFailed' }, { status: 500 });
    }
    if (!building) {
      return NextResponse.json({ error: 'buildingNotFound' }, { status: 404 });
    }
    if (!building.is_active) {
      return NextResponse.json({ error: 'buildingInactive' }, { status: 409 });
    }

    const insert: ApartmentInsert = {
      building_id: buildingId,
      apartment_number,
      floor,
      description_en: trimStr(b.description_en, MAX_DESC) ?? '',
      description_ar: trimStr(b.description_ar, MAX_DESC) ?? '',
      notes: trimStr(b.notes, MAX_NOTES),
      has_kitchen: b.has_kitchen !== false,
      has_living_room: b.has_living_room === true,
      shared_bathroom_count,
      private_bathroom_count,
      is_active: b.is_active !== false,
      sort_order,
    };

    const { data, error: insErr } = await supabase
      .from('apartments')
      .insert(insert)
      .select('id')
      .single();

    if (insErr) {
      if ((insErr as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'apartmentNumberTaken' }, { status: 409 });
      }
      console.error('Apartment create failed:', insErr);
      return NextResponse.json({ error: 'createFailed' }, { status: 500 });
    }

    revalidatePublicBuildings();
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error('Apartment create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

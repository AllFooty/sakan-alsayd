import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';
import { revalidatePublicBuildings } from '@/lib/buildings/public';

const SORTABLE_COLUMNS = [
  'room_number',
  'floor',
  'room_type',
  'monthly_price',
  'status',
  'created_at',
] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

function isSortColumn(value: unknown): value is SortColumn {
  return typeof value === 'string' && (SORTABLE_COLUMNS as readonly string[]).includes(value);
}

const ROOM_STATUS = ['available', 'occupied', 'maintenance', 'reserved'] as const;
const ROOM_TYPES = ['single', 'double', 'triple', 'suite'] as const;
const OCCUPANCY_MODES = ['private', 'shared'] as const;
const MIN_CAPACITY = 1;
const MAX_CAPACITY = 20;
const BATHROOM_TYPES = [
  'shared',
  'shared-a',
  'shared-b',
  'shared-balcony',
  'private',
  'private-balcony',
  'private-two-rooms',
  'master',
  'master-a',
  'master-b',
  'master-balcony',
  'suite',
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SEARCH_LEN = 100;
const SEARCH_STRIP_RE = /[,()*"\\]/g;
const MAX_ROOM_NUMBER = 50;
const MAX_NOTES = 5000;

function safeInt(val: string | null, fallback: number): number {
  const parsed = parseInt(val || String(fallback));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function sanitizeSearch(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.slice(0, MAX_SEARCH_LEN).replace(SEARCH_STRIP_RE, '');
  return trimmed.trim() || null;
}

interface RoomRow {
  id: string;
  building_id: string;
  room_number: string | null;
  floor: number | null;
  room_type: string;
  bathroom_type: string;
  capacity: number;
  occupancy_mode: 'private' | 'shared';
  monthly_price: number;
  discounted_price: number | null;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  images: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get('building_id');
    if (!buildingId || !UUID_RE.test(buildingId)) {
      return NextResponse.json({ error: 'building_id is required' }, { status: 400 });
    }

    // Scope: non-admin-tier sees only assigned buildings.
    if (!hasAdminAccess(profile.role)) {
      const assignedIds = await getAssignedBuildingIds(profile.id);
      if (!assignedIds.includes(buildingId)) {
        return NextResponse.json({ data: [], total: 0, page: 1, limit: 0 });
      }
    }

    const status = searchParams.get('status');
    const roomType = searchParams.get('room_type');
    const search = sanitizeSearch(searchParams.get('search'));
    const limit = Math.min(Math.max(safeInt(searchParams.get('limit'), 50), 1), 200);
    const page = Math.max(safeInt(searchParams.get('page'), 1), 1);
    const offset = (page - 1) * limit;

    const sortParam = searchParams.get('sort');
    const dirParam = searchParams.get('dir');
    const sortColumn: SortColumn = isSortColumn(sortParam) ? sortParam : 'room_number';
    const sortAscending = dirParam !== 'desc';

    let query = supabase
      .from('rooms')
      .select(
        'id, building_id, room_number, floor, room_type, bathroom_type, capacity, occupancy_mode, monthly_price, discounted_price, status, images, notes, created_at, updated_at',
        { count: 'exact' }
      )
      .eq('building_id', buildingId)
      .order(sortColumn, { ascending: sortAscending, nullsFirst: false });

    if (sortColumn !== 'created_at') {
      query = query.order('created_at', { ascending: false });
    }

    if (status && (ROOM_STATUS as readonly string[]).includes(status)) {
      query = query.eq('status', status);
    }
    if (roomType && (ROOM_TYPES as readonly string[]).includes(roomType)) {
      query = query.eq('room_type', roomType);
    }
    if (search) {
      query = query.ilike('room_number', `%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('Error fetching rooms:', error);
      return NextResponse.json({ error: 'Failed to fetch rooms' }, { status: 500 });
    }

    return NextResponse.json({
      data: (data || []) as RoomRow[],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Rooms list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- POST: create a new room -----

function trimStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function isNonNegFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

interface RoomInsert {
  building_id: string;
  room_number: string | null;
  floor: number | null;
  room_type: (typeof ROOM_TYPES)[number];
  bathroom_type: (typeof BATHROOM_TYPES)[number];
  capacity: number;
  occupancy_mode: (typeof OCCUPANCY_MODES)[number];
  monthly_price: number;
  discounted_price: number | null;
  status: (typeof ROOM_STATUS)[number];
  notes: string | null;
}

function defaultCapacityForType(rt: (typeof ROOM_TYPES)[number]): number {
  // Mirrors migration 021's backfill logic so the API matches existing data.
  switch (rt) {
    case 'single': return 1;
    case 'double': return 2;
    case 'triple': return 3;
    case 'suite':  return 2;
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const building_id = trimStr(b.building_id, 100);
    if (!building_id || !UUID_RE.test(building_id)) {
      return NextResponse.json({ error: 'invalidBuildingId' }, { status: 400 });
    }

    const room_type = b.room_type;
    if (typeof room_type !== 'string' || !(ROOM_TYPES as readonly string[]).includes(room_type)) {
      return NextResponse.json({ error: 'invalidRoomType' }, { status: 400 });
    }

    const bathroom_type = b.bathroom_type;
    if (
      typeof bathroom_type !== 'string' ||
      !(BATHROOM_TYPES as readonly string[]).includes(bathroom_type)
    ) {
      return NextResponse.json({ error: 'invalidBathroomType' }, { status: 400 });
    }

    if (!isPositiveFinite(b.monthly_price)) {
      return NextResponse.json({ error: 'invalidPrice' }, { status: 400 });
    }
    const monthly_price = b.monthly_price;

    let discounted_price: number | null = null;
    if (b.discounted_price !== undefined && b.discounted_price !== null) {
      if (!isNonNegFinite(b.discounted_price)) {
        return NextResponse.json({ error: 'invalidPrice' }, { status: 400 });
      }
      if (b.discounted_price > monthly_price) {
        return NextResponse.json({ error: 'discountExceedsPrice' }, { status: 400 });
      }
      discounted_price = b.discounted_price;
    }

    let status: (typeof ROOM_STATUS)[number] = 'available';
    if (b.status !== undefined) {
      if (typeof b.status !== 'string' || !(ROOM_STATUS as readonly string[]).includes(b.status)) {
        return NextResponse.json({ error: 'invalidStatus' }, { status: 400 });
      }
      status = b.status as (typeof ROOM_STATUS)[number];
    }

    let floor: number | null = null;
    if (b.floor !== undefined && b.floor !== null && b.floor !== '') {
      if (typeof b.floor !== 'number' || !Number.isFinite(b.floor)) {
        return NextResponse.json({ error: 'invalidFloor' }, { status: 400 });
      }
      floor = Math.trunc(b.floor);
    }

    let capacity = defaultCapacityForType(room_type as (typeof ROOM_TYPES)[number]);
    if (b.capacity !== undefined && b.capacity !== null && b.capacity !== '') {
      if (
        typeof b.capacity !== 'number' ||
        !Number.isFinite(b.capacity) ||
        !Number.isInteger(b.capacity) ||
        b.capacity < MIN_CAPACITY ||
        b.capacity > MAX_CAPACITY
      ) {
        return NextResponse.json({ error: 'invalidCapacity' }, { status: 400 });
      }
      capacity = b.capacity;
    }

    let occupancy_mode: (typeof OCCUPANCY_MODES)[number] = 'private';
    if (b.occupancy_mode !== undefined && b.occupancy_mode !== null) {
      if (
        typeof b.occupancy_mode !== 'string' ||
        !(OCCUPANCY_MODES as readonly string[]).includes(b.occupancy_mode)
      ) {
        return NextResponse.json({ error: 'invalidOccupancyMode' }, { status: 400 });
      }
      occupancy_mode = b.occupancy_mode as (typeof OCCUPANCY_MODES)[number];
    }
    // A 1-bed room can't meaningfully be "shared" — there's no second tenant
    // to share with. Force private at the API boundary so a malformed client
    // can't introduce nonsensical state.
    if (capacity === 1 && occupancy_mode === 'shared') {
      occupancy_mode = 'private';
    }

    const room_number = trimStr(b.room_number, MAX_ROOM_NUMBER);
    const notes = trimStr(b.notes, MAX_NOTES);

    // Verify the target building exists and is active. Soft-deleted buildings
    // are read-only — admins can reactivate first if they really need to add
    // a room to one.
    const { data: building, error: bldgErr } = await supabase
      .from('buildings')
      .select('id, is_active')
      .eq('id', building_id)
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

    const insert: RoomInsert = {
      building_id,
      room_number,
      floor,
      room_type: room_type as (typeof ROOM_TYPES)[number],
      bathroom_type: bathroom_type as (typeof BATHROOM_TYPES)[number],
      capacity,
      occupancy_mode,
      monthly_price,
      discounted_price,
      status,
      notes,
    };

    const { data, error } = await supabase
      .from('rooms')
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      console.error('Room create failed:', error);
      return NextResponse.json({ error: 'createFailed' }, { status: 500 });
    }

    revalidatePublicBuildings();
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error('Room create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

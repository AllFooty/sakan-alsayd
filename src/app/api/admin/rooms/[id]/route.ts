import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';
import { revalidatePublicBuildings } from '@/lib/buildings/public';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RoomRow {
  id: string;
  building_id: string;
  room_number: string | null;
  floor: number | null;
  room_type: string;
  bathroom_type: string;
  monthly_price: number;
  discounted_price: number | null;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  images: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AssignmentRow {
  id: string;
  resident_id: string;
  check_in_date: string;
  check_out_date: string | null;
  status: 'active' | 'ended';
  created_at: string;
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

interface MaintenanceRow {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  assigned_staff: { id: string; full_name: string } | null;
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

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select(
        'id, building_id, room_number, floor, room_type, bathroom_type, monthly_price, discounted_price, status, images, notes, created_at, updated_at'
      )
      .eq('id', id)
      .maybeSingle<RoomRow>();

    if (roomErr) {
      console.error('Error fetching room:', roomErr);
      return NextResponse.json({ error: 'Failed to fetch room' }, { status: 500 });
    }
    if (!room) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Scope: non-admin-tier roles only see rooms in their assigned buildings.
    // Use 404 (not 403) to avoid leaking existence.
    if (!hasAdminAccess(profile.role)) {
      const assignedIds = await getAssignedBuildingIds(profile.id);
      if (!assignedIds.includes(room.building_id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    // Fetch building summary, assignments (with residents), and maintenance in parallel.
    const [buildingRes, assignmentsRes, maintenanceRes] = await Promise.all([
      supabase
        .from('buildings')
        .select('id, slug, city_en, city_ar, neighborhood_en, neighborhood_ar')
        .eq('id', room.building_id)
        .maybeSingle(),
      supabase
        .from('room_assignments')
        .select(
          `
          id, resident_id, check_in_date, check_out_date, status, created_at,
          resident:residents(id, full_name, phone, email, nationality, profile_image, status)
        `
        )
        .eq('room_id', id)
        .order('check_in_date', { ascending: false })
        .returns<AssignmentRow[]>(),
      supabase
        .from('maintenance_requests')
        .select(
          `
          id, title, category, priority, status, created_at, completed_at,
          assigned_staff:staff_profiles!assigned_to(id, full_name)
        `
        )
        .eq('room_id', id)
        .order('created_at', { ascending: false })
        .returns<MaintenanceRow[]>(),
    ]);

    if (buildingRes.error) {
      console.error('Error fetching building summary:', buildingRes.error);
    }
    if (assignmentsRes.error) {
      console.error('Error fetching assignments:', assignmentsRes.error);
    }
    if (maintenanceRes.error) {
      console.error('Error fetching maintenance history:', maintenanceRes.error);
    }

    const assignments = assignmentsRes.data ?? [];
    const currentAssignment = assignments.find((a) => a.status === 'active') ?? null;

    return NextResponse.json({
      data: {
        ...room,
        building: buildingRes.data ?? null,
        current_assignment: currentAssignment,
        assignment_history: assignments,
        maintenance_history: maintenanceRes.data ?? [],
      },
    });
  } catch (error) {
    console.error('Room detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- PATCH: edit a room -----

const ROOM_STATUS = ['available', 'occupied', 'maintenance', 'reserved'] as const;
const ROOM_TYPES = ['single', 'double', 'triple', 'suite'] as const;
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

const MAX_ROOM_NUMBER = 50;
const MAX_NOTES = 5000;

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

    // Look up the room to authorize against its building.
    const { data: existing, error: fetchErr } = await supabase
      .from('rooms')
      .select(
        'id, building_id, monthly_price, discounted_price, building:buildings!building_id(is_active)'
      )
      .eq('id', id)
      .maybeSingle<{
        id: string;
        building_id: string;
        monthly_price: number;
        discounted_price: number | null;
        building: { is_active: boolean } | null;
      }>();
    if (fetchErr) {
      console.error('Room lookup failed:', fetchErr);
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

    // Rooms inherit their parent's lifecycle — no edits while the building is
    // soft-deleted. Reactivate the building first.
    if (existing.building && !existing.building.is_active) {
      return NextResponse.json({ error: 'buildingInactive' }, { status: 409 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    const updates: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(b, 'room_number')) {
      const v = b.room_number;
      if (v === null || v === '') {
        updates.room_number = null;
      } else {
        const t = trimStr(v, MAX_ROOM_NUMBER);
        updates.room_number = t;
      }
    }

    if (Object.prototype.hasOwnProperty.call(b, 'floor')) {
      const v = b.floor;
      if (v === null || v === '') {
        updates.floor = null;
      } else if (typeof v !== 'number' || !Number.isFinite(v)) {
        return NextResponse.json({ error: 'invalidFloor' }, { status: 400 });
      } else {
        updates.floor = Math.trunc(v);
      }
    }

    if (Object.prototype.hasOwnProperty.call(b, 'room_type')) {
      const v = b.room_type;
      if (typeof v !== 'string' || !(ROOM_TYPES as readonly string[]).includes(v)) {
        return NextResponse.json({ error: 'invalidRoomType' }, { status: 400 });
      }
      updates.room_type = v;
    }

    if (Object.prototype.hasOwnProperty.call(b, 'bathroom_type')) {
      const v = b.bathroom_type;
      if (typeof v !== 'string' || !(BATHROOM_TYPES as readonly string[]).includes(v)) {
        return NextResponse.json({ error: 'invalidBathroomType' }, { status: 400 });
      }
      updates.bathroom_type = v;
    }

    // Resolve final monthly + discounted prices to validate the cross-field
    // constraint regardless of which (or both) fields were sent.
    const monthlyPriceProvided = Object.prototype.hasOwnProperty.call(b, 'monthly_price');
    const discountedPriceProvided = Object.prototype.hasOwnProperty.call(b, 'discounted_price');

    let nextMonthly = existing.monthly_price;
    if (monthlyPriceProvided) {
      if (!isPositiveFinite(b.monthly_price)) {
        return NextResponse.json({ error: 'invalidPrice' }, { status: 400 });
      }
      nextMonthly = b.monthly_price;
      updates.monthly_price = nextMonthly;
    }

    let nextDiscounted: number | null = existing.discounted_price;
    if (discountedPriceProvided) {
      const v = b.discounted_price;
      if (v === null || v === '') {
        nextDiscounted = null;
        updates.discounted_price = null;
      } else if (!isNonNegFinite(v)) {
        return NextResponse.json({ error: 'invalidPrice' }, { status: 400 });
      } else {
        nextDiscounted = v;
        updates.discounted_price = v;
      }
    }

    if (nextDiscounted !== null && nextDiscounted > nextMonthly) {
      return NextResponse.json({ error: 'discountExceedsPrice' }, { status: 400 });
    }

    if (Object.prototype.hasOwnProperty.call(b, 'status')) {
      const v = b.status;
      if (typeof v !== 'string' || !(ROOM_STATUS as readonly string[]).includes(v)) {
        return NextResponse.json({ error: 'invalidStatus' }, { status: 400 });
      }
      updates.status = v;
    }

    if (Object.prototype.hasOwnProperty.call(b, 'notes')) {
      const v = b.notes;
      if (v === null || v === '') {
        updates.notes = null;
      } else {
        updates.notes = trimStr(v, MAX_NOTES);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'noChanges' }, { status: 400 });
    }

    const { error: updErr } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', id);
    if (updErr) {
      console.error('Room update failed:', updErr);
      return NextResponse.json({ error: 'updateFailed' }, { status: 500 });
    }

    revalidatePublicBuildings();
    return NextResponse.json({ id });
  } catch (error) {
    console.error('Room update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- DELETE: hard-delete a room -----
// Rooms have no soft-delete column. `room_assignments.room_id` references
// rooms with ON DELETE RESTRICT, so any room with even one historical
// assignment will fail with Postgres 23503 — surface that as
// `roomHasAssignments` so the form can suggest setting status to maintenance.
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
      .from('rooms')
      .select('id')
      .eq('id', id)
      .maybeSingle<{ id: string }>();
    if (fetchErr) {
      console.error('Room lookup failed:', fetchErr);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { error: delErr } = await supabase.from('rooms').delete().eq('id', id);
    if (delErr) {
      if ((delErr as { code?: string }).code === '23503') {
        return NextResponse.json({ error: 'roomHasAssignments' }, { status: 409 });
      }
      console.error('Room delete failed:', delErr);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }

    revalidatePublicBuildings();
    return NextResponse.json({ id });
  } catch (error) {
    console.error('Room delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

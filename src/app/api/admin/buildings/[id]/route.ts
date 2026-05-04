import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import {
  canReadOccupants,
  getAssignedBuildingIds,
  hasAdminAccess,
} from '@/lib/auth/guards';
import { revalidatePublicBuildings } from '@/lib/buildings/public';

interface BuildingRow {
  id: string;
  slug: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
  description_en: string;
  description_ar: string;
  cover_image: string | null;
  images: string[] | null;
  map_url: string | null;
  landmarks: unknown;
  is_active: boolean;
  is_placeholder: boolean;
  sort_order: number;
  operational_since: string;
  created_at: string;
  updated_at: string;
}

interface RoomFloorMapRow {
  id: string;
  room_number: string | null;
  floor: number | null;
  room_type: string;
  capacity: number;
  occupancy_mode: 'private' | 'shared';
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  apartment_id: string;
  apartment: { id: string; apartment_number: string; floor: number } | null;
}

interface AssignmentRow {
  id: string;
  room_id: string;
  resident_id: string;
  check_in_date: string;
  resident: { id: string; full_name: string } | null;
}

interface ActiveAssignmentLite {
  id: string;
  resident_id: string;
  resident_name: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
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

    // Non-admin-tier roles only see buildings they're assigned to.
    // Use 404 (not 403) for unassigned buildings to avoid leaking existence.
    if (!hasAdminAccess(profile.role)) {
      const assignedIds = await getAssignedBuildingIds(profile.id);
      if (!assignedIds.includes(id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    const { data: building, error: buildingErr } = await supabase
      .from('buildings')
      .select(
        'id, slug, city_en, city_ar, neighborhood_en, neighborhood_ar, description_en, description_ar, cover_image, images, map_url, landmarks, is_active, is_placeholder, sort_order, operational_since, created_at, updated_at'
      )
      .eq('id', id)
      .maybeSingle<BuildingRow>();

    if (buildingErr) {
      console.error('Error fetching building:', buildingErr);
      return NextResponse.json({ error: 'Failed to fetch building' }, { status: 500 });
    }
    if (!building) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // RLS on residents + room_assignments is gated to admin tier +
    // branch_manager + supervision_staff (014_rls_perf.sql,
    // 027_residents_supervision_staff_and_capacity.sql). Other roles allowed
    // on this endpoint (maintenance/finance/transportation managers + staff)
    // would silently get zero rows from the join — making every building look
    // empty. Skip the fetch entirely for them and signal via
    // `can_view_occupants` so the UI can render a "no access" placeholder
    // instead of misleading vacant bars.
    const occupantsVisible = canReadOccupants(profile.role);

    // Run aggregate queries in parallel. Rooms carry the per-room fields the
    // floor-map tab needs (capacity, occupancy_mode); active assignments are
    // pulled with their room_id so we can compute per-room occupied-bed
    // counts client-side without N round-trips.
    const [roomsRes, activeMaintRes, activeAssignmentsRes, apartmentsCountRes] =
      await Promise.all([
        supabase
          .from('rooms')
          .select(
            'id, room_number, floor, room_type, capacity, occupancy_mode, status, apartment_id, apartment:apartments!apartment_id(id, apartment_number, floor)'
          )
          .eq('building_id', id)
          .returns<RoomFloorMapRow[]>(),
        supabase
          .from('maintenance_requests')
          .select('id', { count: 'exact', head: true })
          .eq('building_id', id)
          .not('status', 'in', '(completed,cancelled)'),
        occupantsVisible
          ? supabase
              .from('room_assignments')
              .select(
                'id, room_id, resident_id, check_in_date, resident:residents(id, full_name)'
              )
              .eq('building_id', id)
              .eq('status', 'active')
              .order('check_in_date', { ascending: true })
              .order('id', { ascending: true })
              .returns<AssignmentRow[]>()
          : Promise.resolve({ data: [] as AssignmentRow[], error: null }),
        supabase
          .from('apartments')
          .select('id', { count: 'exact', head: true })
          .eq('building_id', id),
      ]);

    if (roomsRes.error) {
      console.error('Error fetching rooms:', roomsRes.error);
      return NextResponse.json({ error: 'Failed to fetch building' }, { status: 500 });
    }
    if (activeMaintRes.error) {
      console.error('Error fetching maintenance count:', activeMaintRes.error);
      return NextResponse.json({ error: 'Failed to fetch building' }, { status: 500 });
    }
    if (activeAssignmentsRes.error) {
      console.error('Error fetching assignments:', activeAssignmentsRes.error);
      return NextResponse.json({ error: 'Failed to fetch building' }, { status: 500 });
    }
    if (apartmentsCountRes.error) {
      console.error('Error fetching apartments count:', apartmentsCountRes.error);
      return NextResponse.json({ error: 'Failed to fetch building' }, { status: 500 });
    }

    const roomRows = (roomsRes.data || []) as RoomFloorMapRow[];
    const activeAssignments = (activeAssignmentsRes.data || []) as AssignmentRow[];

    // Pre-sorted by check_in_date ASC at the query — preserves stable
    // segment order in the floor-map bar across refetches.
    const activeAssignmentsByRoom = new Map<string, ActiveAssignmentLite[]>();
    for (const a of activeAssignments) {
      const list = activeAssignmentsByRoom.get(a.room_id) ?? [];
      list.push({
        id: a.id,
        resident_id: a.resident_id,
        resident_name: a.resident?.full_name ?? '',
      });
      activeAssignmentsByRoom.set(a.room_id, list);
    }

    const stats = { total: 0, available: 0, occupied: 0, maintenance: 0, reserved: 0 };
    for (const r of roomRows) {
      stats.total += 1;
      stats[r.status] += 1;
    }

    const rooms = roomRows.map((r) => {
      const assignments = activeAssignmentsByRoom.get(r.id) ?? [];
      return {
        id: r.id,
        room_number: r.room_number,
        floor: r.floor,
        room_type: r.room_type,
        capacity: r.capacity,
        occupancy_mode: r.occupancy_mode,
        status: r.status,
        apartment_id: r.apartment_id,
        apartment: r.apartment,
        active_assignments: assignments,
        active_assignments_count: assignments.length,
      };
    });

    return NextResponse.json({
      data: {
        ...building,
        room_stats: stats,
        rooms,
        active_maintenance_count: activeMaintRes.count ?? 0,
        // active_residents_count is also occupant-restricted; null (rather
        // than 0) so the UI can distinguish "no data" from "zero residents".
        active_residents_count: occupantsVisible ? activeAssignments.length : null,
        apartments_count: apartmentsCountRes.count ?? 0,
        can_view_occupants: occupantsVisible,
      },
    });
  } catch (error) {
    console.error('Building detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- PATCH: edit a building -----

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_RE = /^https?:\/\/.+/i;
const MAX_TEXT = 500;
const MAX_DESC = 5000;
const MAX_LANDMARKS = 20;
const MAX_IMAGES = 20;
const MAX_URL = 1000;

interface LandmarkInput {
  name_en: string;
  name_ar: string;
  distance_en?: string;
  distance_ar?: string;
}

function trimStr(v: unknown, max = MAX_TEXT): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normalizeLandmarks(raw: unknown): LandmarkInput[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_LANDMARKS) return null;
  const out: LandmarkInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null;
    const e = entry as Record<string, unknown>;
    const name_en = trimStr(e.name_en);
    const name_ar = trimStr(e.name_ar);
    const distance_en = trimStr(e.distance_en);
    const distance_ar = trimStr(e.distance_ar);
    if (!name_en && !name_ar && !distance_en && !distance_ar) continue;
    if (!name_en || !name_ar) return null;
    out.push({
      name_en,
      name_ar,
      ...(distance_en ? { distance_en } : {}),
      ...(distance_ar ? { distance_ar } : {}),
    });
  }
  return out;
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

    if (!hasAdminAccess(profile.role)) {
      const assignedIds = await getAssignedBuildingIds(profile.id);
      if (!assignedIds.includes(id)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    // Pull current row so we can validate cover_image ∈ images cross-field
    // and gate writes on inactive buildings.
    const { data: current, error: currentErr } = await supabase
      .from('buildings')
      .select('cover_image, images, is_active')
      .eq('id', id)
      .maybeSingle<{
        cover_image: string | null;
        images: string[] | null;
        is_active: boolean;
      }>();
    if (currentErr) {
      console.error('Building current-state fetch failed:', currentErr);
      return NextResponse.json({ error: 'updateFailed' }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(b, 'slug')) {
      const slug = trimStr(b.slug, 100);
      if (!slug || !SLUG_RE.test(slug)) {
        return NextResponse.json({ error: 'invalidSlug' }, { status: 400 });
      }
      updates.slug = slug;
    }
    for (const k of ['city_en', 'city_ar', 'neighborhood_en', 'neighborhood_ar'] as const) {
      if (Object.prototype.hasOwnProperty.call(b, k)) {
        const v = trimStr(b[k]);
        if (!v) {
          return NextResponse.json({ error: 'requiredFieldsMissing' }, { status: 400 });
        }
        updates[k] = v;
      }
    }
    for (const k of ['description_en', 'description_ar'] as const) {
      if (Object.prototype.hasOwnProperty.call(b, k)) {
        updates[k] = trimStr(b[k], MAX_DESC) ?? '';
      }
    }
    if (Object.prototype.hasOwnProperty.call(b, 'map_url')) {
      const v = trimStr(b.map_url);
      if (v && !URL_RE.test(v)) {
        return NextResponse.json({ error: 'invalidMapUrl' }, { status: 400 });
      }
      updates.map_url = v;
    }
    if (Object.prototype.hasOwnProperty.call(b, 'landmarks')) {
      const lms = normalizeLandmarks(b.landmarks);
      if (lms === null) {
        return NextResponse.json({ error: 'invalidLandmarks' }, { status: 400 });
      }
      updates.landmarks = lms;
    }
    // Status flags are admin-tier only. The DELETE endpoint is also admin-tier;
    // gating these here closes the soft-delete bypass that would otherwise let
    // a scoped branch_manager flip is_active=false via PATCH.
    if (Object.prototype.hasOwnProperty.call(b, 'is_active')) {
      if (!hasAdminAccess(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      updates.is_active = b.is_active === true;
    }
    if (Object.prototype.hasOwnProperty.call(b, 'is_placeholder')) {
      if (!hasAdminAccess(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      updates.is_placeholder = b.is_placeholder === true;
    }
    // operational_since is the manager-asserted "when did this building come
    // online" date, separate from the row's created_at. Admin-tier only so
    // it can't be silently rewritten by branch staff.
    if (Object.prototype.hasOwnProperty.call(b, 'operational_since')) {
      if (!hasAdminAccess(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const v = b.operational_since;
      if (v === null || (typeof v === 'string' && v.trim() === '')) {
        return NextResponse.json({ error: 'invalidOperationalSince' }, { status: 400 });
      } else if (typeof v === 'string') {
        const t = v.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
          return NextResponse.json({ error: 'invalidOperationalSince' }, { status: 400 });
        }
        const parsed = new Date(t + 'T00:00:00Z');
        if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
          return NextResponse.json({ error: 'invalidOperationalSince' }, { status: 400 });
        }
        updates.operational_since = t;
      } else {
        return NextResponse.json({ error: 'invalidOperationalSince' }, { status: 400 });
      }
    }
    if (Object.prototype.hasOwnProperty.call(b, 'sort_order')) {
      const n = b.sort_order;
      if (typeof n !== 'number' || !Number.isFinite(n)) {
        return NextResponse.json({ error: 'invalidSortOrder' }, { status: 400 });
      }
      updates.sort_order = Math.trunc(n);
    }
    if (Object.prototype.hasOwnProperty.call(b, 'cover_image')) {
      const v = b.cover_image;
      if (v === null) {
        updates.cover_image = null;
      } else if (typeof v === 'string') {
        const t = v.trim();
        if (!t) {
          updates.cover_image = null;
        } else if (!URL_RE.test(t) || t.length > MAX_URL) {
          return NextResponse.json({ error: 'invalidCoverImage' }, { status: 400 });
        } else {
          updates.cover_image = t;
        }
      } else {
        return NextResponse.json({ error: 'invalidCoverImage' }, { status: 400 });
      }
    }
    if (Object.prototype.hasOwnProperty.call(b, 'images')) {
      const v = b.images;
      if (!Array.isArray(v)) {
        return NextResponse.json({ error: 'invalidImages' }, { status: 400 });
      }
      if (v.length > MAX_IMAGES) {
        return NextResponse.json({ error: 'tooManyImages' }, { status: 400 });
      }
      const cleaned: string[] = [];
      for (const item of v) {
        if (typeof item !== 'string') {
          return NextResponse.json({ error: 'invalidImages' }, { status: 400 });
        }
        const t = item.trim();
        if (!t || !URL_RE.test(t) || t.length > MAX_URL) {
          return NextResponse.json({ error: 'invalidImages' }, { status: 400 });
        }
        cleaned.push(t);
      }
      // Preserve insertion order; allow duplicates? Reject for cleanliness.
      if (new Set(cleaned).size !== cleaned.length) {
        return NextResponse.json({ error: 'duplicateImages' }, { status: 400 });
      }
      updates.images = cleaned;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'noChanges' }, { status: 400 });
    }

    // Inactive buildings are read-only except for admin-tier reactivation.
    // This makes "soft-deleted" mean what it says — no editing of metadata,
    // photos, slug, etc. while is_active=false.
    if (!current.is_active) {
      const onlyReactivating =
        Object.keys(updates).length === 1 && updates.is_active === true;
      if (!onlyReactivating) {
        return NextResponse.json({ error: 'buildingInactive' }, { status: 409 });
      }
    }

    // Cross-field: when the PATCH touches cover_image or images, the resulting
    // cover must point at an image in the array. Skip the check if neither is
    // in the body — preserves any pre-existing inconsistencies in legacy rows
    // without forcing callers to repair them on unrelated edits.
    const coverInBody = Object.prototype.hasOwnProperty.call(updates, 'cover_image');
    const imagesInBody = Object.prototype.hasOwnProperty.call(updates, 'images');
    if (coverInBody || imagesInBody) {
      const finalImages = imagesInBody
        ? (updates.images as string[])
        : current.images ?? [];
      let finalCover: string | null;
      if (coverInBody) {
        finalCover = updates.cover_image as string | null;
      } else {
        finalCover =
          current.cover_image && finalImages.includes(current.cover_image)
            ? current.cover_image
            : null;
        if (finalCover !== current.cover_image) {
          updates.cover_image = finalCover;
        }
      }
      if (finalCover !== null && !finalImages.includes(finalCover)) {
        return NextResponse.json({ error: 'coverNotInImages' }, { status: 400 });
      }
    }

    const { error: updErr } = await supabase
      .from('buildings')
      .update(updates)
      .eq('id', id);
    if (updErr) {
      if ((updErr as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'slugTaken' }, { status: 409 });
      }
      console.error('Building update failed:', updErr);
      return NextResponse.json({ error: 'updateFailed' }, { status: 500 });
    }

    revalidatePublicBuildings();
    return NextResponse.json({ id });
  } catch (error) {
    console.error('Building update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- DELETE: soft-delete (deactivate) a building -----
// Buildings cascade-delete to rooms (and room_assignments restrict on rooms),
// so a hard DELETE would fail on any populated building. We deactivate
// instead: is_active=false hides the building from the public-facing API
// (which already filters is_active=true) while preserving history.
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
      .from('buildings')
      .select('id, is_active')
      .eq('id', id)
      .maybeSingle<{ id: string; is_active: boolean }>();
    if (fetchErr) {
      console.error('Building lookup failed:', fetchErr);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!existing.is_active) {
      return NextResponse.json({ id, already_inactive: true });
    }

    const { error: updErr } = await supabase
      .from('buildings')
      .update({ is_active: false })
      .eq('id', id);
    if (updErr) {
      console.error('Building deactivate failed:', updErr);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }

    revalidatePublicBuildings();
    return NextResponse.json({ id });
  } catch (error) {
    console.error('Building delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

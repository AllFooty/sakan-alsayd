import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import type {
  ResidentRow,
  ResidentStatus,
  ResidentDetailPayload,
  ResidentAssignmentHistoryItem,
  ResidentMaintenanceItem,
  AssignmentStatus,
} from '@/lib/residents/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Joined-row shapes for the embedded-resource Supabase queries. With single-
// column FKs the related rows come back as objects (not arrays), so type them
// as such — using `any` here would mask future schema drift.
interface JoinedAssignmentRow {
  id: string;
  room_id: string;
  building_id: string;
  check_in_date: string;
  check_out_date: string | null;
  status: AssignmentStatus;
  created_at: string;
  rooms: {
    room_number: string | null;
    floor: number | null;
  } | null;
  buildings: {
    city_en: string;
    city_ar: string;
    neighborhood_en: string;
    neighborhood_ar: string;
  } | null;
}

interface MaintenanceHistoryRow {
  id: string;
  title: string | null;
  status: string;
  priority: string;
  category: string;
  created_at: string;
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
      'supervision_staff'
    );
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    // 1. Fetch resident row first. 404 (not 403) on misses for non-admin-tier
    //    later, to avoid leaking existence — same convention as buildings.
    const { data: resident, error: residentErr } = await supabase
      .from('residents')
      .select(
        'id, full_name, phone, email, national_id_or_iqama, nationality, date_of_birth, university_or_workplace, emergency_contact_name, emergency_contact_phone, profile_image, documents, status, notes, created_at, updated_at'
      )
      .eq('id', id)
      .maybeSingle<ResidentRow>();

    if (residentErr) {
      console.error('Error fetching resident:', residentErr);
      return NextResponse.json({ error: 'Failed to fetch resident' }, { status: 500 });
    }
    if (!resident) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 2. Run aggregate queries in parallel.
    const [assignmentsRes, maintenanceRes] = await Promise.all([
      supabase
        .from('room_assignments')
        .select(
          'id, room_id, building_id, check_in_date, check_out_date, status, created_at, rooms(room_number, floor), buildings(city_en, city_ar, neighborhood_en, neighborhood_ar)'
        )
        .eq('resident_id', id)
        .order('created_at', { ascending: false })
        .limit(50)
        .returns<JoinedAssignmentRow[]>(),
      supabase
        .from('maintenance_requests')
        .select('id, title, status, priority, category, created_at')
        .eq('resident_id', id)
        .order('created_at', { ascending: false })
        .limit(50)
        .returns<MaintenanceHistoryRow[]>(),
    ]);

    if (assignmentsRes.error) {
      console.error('Error fetching assignments:', assignmentsRes.error);
      return NextResponse.json({ error: 'Failed to fetch resident' }, { status: 500 });
    }
    if (maintenanceRes.error) {
      console.error('Error fetching maintenance history:', maintenanceRes.error);
      return NextResponse.json({ error: 'Failed to fetch resident' }, { status: 500 });
    }

    const assignmentRows: JoinedAssignmentRow[] = assignmentsRes.data ?? [];
    const maintenanceRows: MaintenanceHistoryRow[] = maintenanceRes.data ?? [];

    // 3. Scope check for non-admin-tier roles. Resident is visible only if at
    //    least one of their assignments lives in a building this staff is
    //    assigned to. No assignments + non-admin-tier = 404 (existence hide).
    if (!hasAdminAccess(profile.role)) {
      const assignedIds = await getAssignedBuildingIds(profile.id);
      const intersects = assignmentRows.some((a) =>
        assignedIds.includes(a.building_id)
      );
      if (!intersects) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    // 4. Flatten joined rows + derive current_assignment from the active row.
    const assignment_history: ResidentAssignmentHistoryItem[] = assignmentRows.map(
      (a) => ({
        id: a.id,
        room_id: a.room_id,
        building_id: a.building_id,
        check_in_date: a.check_in_date,
        check_out_date: a.check_out_date,
        status: a.status,
        created_at: a.created_at,
        room_number: a.rooms?.room_number ?? null,
        floor: a.rooms?.floor ?? null,
        building_city_en: a.buildings?.city_en ?? '',
        building_city_ar: a.buildings?.city_ar ?? '',
        building_neighborhood_en: a.buildings?.neighborhood_en ?? '',
        building_neighborhood_ar: a.buildings?.neighborhood_ar ?? '',
      })
    );

    const activeRow = assignmentRows.find((a) => a.status === 'active') ?? null;
    const current_assignment: ResidentDetailPayload['current_assignment'] = activeRow
      ? {
          id: activeRow.id,
          room_id: activeRow.room_id,
          building_id: activeRow.building_id,
          check_in_date: activeRow.check_in_date,
          check_out_date: activeRow.check_out_date,
          room_number: activeRow.rooms?.room_number ?? null,
          floor: activeRow.rooms?.floor ?? null,
          building_city_en: activeRow.buildings?.city_en ?? '',
          building_city_ar: activeRow.buildings?.city_ar ?? '',
          building_neighborhood_en: activeRow.buildings?.neighborhood_en ?? '',
          building_neighborhood_ar: activeRow.buildings?.neighborhood_ar ?? '',
        }
      : null;

    const maintenance_history: ResidentMaintenanceItem[] = maintenanceRows.map(
      (m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        priority: m.priority,
        category: m.category,
        created_at: m.created_at,
      })
    );

    const payload: ResidentDetailPayload = {
      ...resident,
      current_assignment,
      assignment_history,
      maintenance_history,
    };

    return NextResponse.json({ data: payload });
  } catch (error) {
    console.error('Resident detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- PATCH: edit a resident -----

const MAX_NAME = 200;
const MAX_TEXT = 500;
const MAX_NOTES = 5000;
const MAX_PHONE = 30;
const MAX_EMAIL = 254;
const MAX_URL = 1000;
const MAX_DOCUMENTS = 20;

const PHONE_RE = /^\+?[0-9\s-]{6,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/.+/i;

const RESIDENT_STATUSES: readonly ResidentStatus[] = [
  'active',
  'checked_out',
  'suspended',
];

function trimStrPatch(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function checkResidentScope(
  supabase: SupabaseServerClient,
  residentId: string,
  staffId: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data, error } = await supabase
    .from('room_assignments')
    .select('building_id')
    .eq('resident_id', residentId)
    .returns<{ building_id: string }[]>();
  if (error) {
    console.error('Resident scope-check failed:', error);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
    };
  }
  const assignedIds = await getAssignedBuildingIds(staffId);
  const intersects = (data ?? []).some((row) => assignedIds.includes(row.building_id));
  if (!intersects) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Not found' }, { status: 404 }),
    };
  }
  return { ok: true };
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

    const auth = await authenticateApiRequest('branch_manager', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    // Existence check first.
    const { data: existing, error: existErr } = await supabase
      .from('residents')
      .select('id')
      .eq('id', id)
      .maybeSingle<{ id: string }>();
    if (existErr) {
      console.error('Resident existence-check failed:', existErr);
      return NextResponse.json({ error: 'updateFailed' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Scope check for non-admin-tier — must share at least one building via
    // any room_assignment (any status). Existence-hide on miss.
    if (!hasAdminAccess(profile.role)) {
      const scope = await checkResidentScope(supabase, id, profile.id);
      if (!scope.ok) return scope.response;
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalidBody' }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    const updates: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(b, 'full_name')) {
      const v = trimStrPatch(b.full_name, MAX_NAME);
      if (!v) {
        return NextResponse.json({ error: 'requiredFieldsMissing' }, { status: 400 });
      }
      updates.full_name = v;
    }

    if (Object.prototype.hasOwnProperty.call(b, 'phone')) {
      const v = trimStrPatch(b.phone, MAX_PHONE);
      if (!v || !PHONE_RE.test(v)) {
        return NextResponse.json({ error: 'invalidPhone' }, { status: 400 });
      }
      updates.phone = v;
    }

    if (Object.prototype.hasOwnProperty.call(b, 'email')) {
      const raw = b.email;
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        updates.email = null;
      } else if (typeof raw === 'string') {
        const t = raw.trim().slice(0, MAX_EMAIL);
        if (!EMAIL_RE.test(t)) {
          return NextResponse.json({ error: 'invalidEmail' }, { status: 400 });
        }
        updates.email = t;
      } else {
        return NextResponse.json({ error: 'invalidEmail' }, { status: 400 });
      }
    }

    for (const k of [
      'national_id_or_iqama',
      'nationality',
      'university_or_workplace',
      'emergency_contact_name',
    ] as const) {
      if (Object.prototype.hasOwnProperty.call(b, k)) {
        const raw = b[k];
        if (raw === null) {
          updates[k] = null;
        } else if (typeof raw === 'string') {
          const t = raw.trim();
          updates[k] = t ? t.slice(0, MAX_TEXT) : null;
        } else {
          return NextResponse.json({ error: 'invalidBody' }, { status: 400 });
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(b, 'date_of_birth')) {
      const raw = b.date_of_birth;
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        updates.date_of_birth = null;
      } else if (typeof raw === 'string') {
        const t = raw.trim();
        if (!DATE_RE.test(t)) {
          return NextResponse.json({ error: 'invalidDateOfBirth' }, { status: 400 });
        }
        const year = Number(t.slice(0, 4));
        const now = new Date().getUTCFullYear();
        if (!Number.isFinite(year) || year < 1900 || year > now) {
          return NextResponse.json({ error: 'invalidDateOfBirth' }, { status: 400 });
        }
        const parsed = new Date(t + 'T00:00:00Z');
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: 'invalidDateOfBirth' }, { status: 400 });
        }
        updates.date_of_birth = t;
      } else {
        return NextResponse.json({ error: 'invalidDateOfBirth' }, { status: 400 });
      }
    }

    if (Object.prototype.hasOwnProperty.call(b, 'emergency_contact_phone')) {
      const raw = b.emergency_contact_phone;
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        updates.emergency_contact_phone = null;
      } else if (typeof raw === 'string') {
        const t = raw.trim().slice(0, MAX_PHONE);
        if (!PHONE_RE.test(t)) {
          return NextResponse.json({ error: 'invalidPhone' }, { status: 400 });
        }
        updates.emergency_contact_phone = t;
      } else {
        return NextResponse.json({ error: 'invalidPhone' }, { status: 400 });
      }
    }

    if (Object.prototype.hasOwnProperty.call(b, 'profile_image')) {
      const raw = b.profile_image;
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        updates.profile_image = null;
      } else if (typeof raw === 'string') {
        const t = raw.trim();
        if (!URL_RE.test(t) || t.length > MAX_URL) {
          return NextResponse.json({ error: 'invalidProfileImage' }, { status: 400 });
        }
        updates.profile_image = t;
      } else {
        return NextResponse.json({ error: 'invalidProfileImage' }, { status: 400 });
      }
    }

    if (Object.prototype.hasOwnProperty.call(b, 'status')) {
      const raw = b.status;
      if (
        typeof raw !== 'string' ||
        !RESIDENT_STATUSES.includes(raw as ResidentStatus)
      ) {
        return NextResponse.json({ error: 'invalidStatus' }, { status: 400 });
      }
      updates.status = raw;
    }

    if (Object.prototype.hasOwnProperty.call(b, 'notes')) {
      const raw = b.notes;
      if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        updates.notes = null;
      } else if (typeof raw === 'string') {
        updates.notes = raw.trim().slice(0, MAX_NOTES);
      } else {
        return NextResponse.json({ error: 'invalidBody' }, { status: 400 });
      }
    }

    if (Object.prototype.hasOwnProperty.call(b, 'documents')) {
      const v = b.documents;
      if (!Array.isArray(v)) {
        return NextResponse.json({ error: 'invalidDocuments' }, { status: 400 });
      }
      if (v.length > MAX_DOCUMENTS) {
        return NextResponse.json({ error: 'tooManyDocuments' }, { status: 400 });
      }
      const cleaned: string[] = [];
      for (const item of v) {
        if (typeof item !== 'string') {
          return NextResponse.json({ error: 'invalidDocuments' }, { status: 400 });
        }
        const t = item.trim();
        if (!t || !URL_RE.test(t) || t.length > MAX_URL) {
          return NextResponse.json({ error: 'invalidDocuments' }, { status: 400 });
        }
        cleaned.push(t);
      }
      if (new Set(cleaned).size !== cleaned.length) {
        return NextResponse.json({ error: 'duplicateDocuments' }, { status: 400 });
      }
      updates.documents = cleaned;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'noChanges' }, { status: 400 });
    }

    const { error: updErr } = await supabase
      .from('residents')
      .update(updates)
      .eq('id', id);
    if (updErr) {
      console.error('Resident update failed:', updErr);
      return NextResponse.json({ error: 'updateFailed' }, { status: 500 });
    }

    // Fire-and-forget activity log. Don't await — do not block response on it.
    const changedFields = Object.keys(updates);
    void supabase
      .from('activity_log')
      .insert({
        user_id: profile.id,
        action: 'resident.updated',
        entity_type: 'resident',
        entity_id: id,
        details: { changed_fields: changedFields },
      })
      .then(({ error: logErr }) => {
        if (logErr) {
          console.error('activity_log insert failed (resident.updated):', logErr);
        }
      });

    return NextResponse.json({ id });
  } catch (error) {
    console.error('Resident update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- DELETE: soft-delete (check out) a resident -----
// Residents cannot be hard-deleted because room_assignments has ON DELETE
// RESTRICT on resident_id (migration 001). We transition status to
// 'checked_out' instead. If any active assignment still exists, the caller
// must run the check-out flow first (Slice 5c).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const auth = await authenticateApiRequest('branch_manager', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    const { data: existing, error: existErr } = await supabase
      .from('residents')
      .select('id')
      .eq('id', id)
      .maybeSingle<{ id: string }>();
    if (existErr) {
      console.error('Resident lookup failed:', existErr);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!hasAdminAccess(profile.role)) {
      const scope = await checkResidentScope(supabase, id, profile.id);
      if (!scope.ok) return scope.response;
    }

    // Block soft-delete while any assignment is still active. The caller
    // needs to walk through the explicit check-out flow first.
    const { count: activeCount, error: countErr } = await supabase
      .from('room_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('resident_id', id)
      .eq('status', 'active');
    if (countErr) {
      console.error('Active-assignment count failed:', countErr);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }
    if ((activeCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'residentHasActiveAssignment' },
        { status: 409 }
      );
    }

    const { error: updErr } = await supabase
      .from('residents')
      .update({ status: 'checked_out' satisfies ResidentStatus })
      .eq('id', id);
    if (updErr) {
      console.error('Resident soft-delete failed:', updErr);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }

    void supabase
      .from('activity_log')
      .insert({
        user_id: profile.id,
        action: 'resident.checked_out',
        entity_type: 'resident',
        entity_id: id,
        details: { soft: true },
      })
      .then(({ error: logErr }) => {
        if (logErr) {
          console.error('activity_log insert failed (resident.checked_out):', logErr);
        }
      });

    return NextResponse.json({ id, soft: true });
  } catch (error) {
    console.error('Resident delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

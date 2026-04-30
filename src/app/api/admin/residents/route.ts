import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';
import type { ResidentListItem, ResidentRow, ResidentStatus } from '@/lib/residents/types';

const SORTABLE_COLUMNS = ['full_name', 'created_at', 'updated_at', 'status'] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

function isSortColumn(value: unknown): value is SortColumn {
  return typeof value === 'string' && (SORTABLE_COLUMNS as readonly string[]).includes(value);
}

const RESIDENT_STATUSES: readonly ResidentStatus[] = ['active', 'checked_out', 'suspended'];
function isResidentStatus(value: unknown): value is ResidentStatus {
  return typeof value === 'string' && (RESIDENT_STATUSES as readonly string[]).includes(value);
}

const MAX_SEARCH_LEN = 100;
const SEARCH_STRIP_RE = /[,()*"\\]/g;

function safeInt(val: string | null, fallback: number): number {
  const parsed = parseInt(val || String(fallback));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function sanitizeSearch(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.slice(0, MAX_SEARCH_LEN).replace(SEARCH_STRIP_RE, '');
  return trimmed.trim() || null;
}

interface AssignmentJoinedRow {
  id: string;
  resident_id: string;
  room_id: string;
  building_id: string;
  check_in_date: string;
  check_out_date: string | null;
  rooms: {
    room_number: string | null;
    floor: number | null;
    apartment_id: string | null;
    apartments: {
      id: string;
      apartment_number: string;
    } | null;
  } | null;
  buildings: {
    city_en: string;
    city_ar: string;
    neighborhood_en: string;
    neighborhood_ar: string;
  } | null;
}

type CurrentAssignment = NonNullable<ResidentListItem['current_assignment']>;

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest('branch_manager', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const buildingIdParam = searchParams.get('building_id');
    const nationalityParam = searchParams.get('nationality');
    const search = sanitizeSearch(searchParams.get('search'));
    const limit = Math.min(Math.max(safeInt(searchParams.get('limit'), 25), 1), 100);
    const page = Math.max(safeInt(searchParams.get('page'), 1), 1);
    const offset = (page - 1) * limit;

    const sortParam = searchParams.get('sort');
    const dirParam = searchParams.get('dir');
    const sortColumn: SortColumn = isSortColumn(sortParam) ? sortParam : 'created_at';
    const sortAscending = dirParam === 'asc';

    // Scope non-admin-tier roles to residents whose current active assignment
    // is in a building they're assigned to.
    let assignedBuildingIds: string[] | null = null;
    if (!hasAdminAccess(profile.role)) {
      assignedBuildingIds = await getAssignedBuildingIds(profile.id);
      if (assignedBuildingIds.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, limit });
      }
    }

    // Determine the effective building scope for filtering residents by
    // active room_assignments. Combine the optional ?building_id filter with
    // the role's assigned-building scope (if any).
    let scopedBuildingIds: string[] | null = null;
    if (buildingIdParam) {
      if (assignedBuildingIds && !assignedBuildingIds.includes(buildingIdParam)) {
        return NextResponse.json({ data: [], total: 0, page, limit });
      }
      scopedBuildingIds = [buildingIdParam];
    } else if (assignedBuildingIds) {
      scopedBuildingIds = assignedBuildingIds;
    }

    // If we need to scope by building, pre-fetch the resident IDs whose active
    // assignment falls in that building set. Short-circuit if empty.
    let residentIdScope: string[] | null = null;
    if (scopedBuildingIds) {
      const { data: scopedRows, error: scopedErr } = await supabase
        .from('room_assignments')
        .select('resident_id')
        .eq('status', 'active')
        .in('building_id', scopedBuildingIds);

      if (scopedErr) {
        console.error('Error scoping residents by building:', scopedErr);
        return NextResponse.json({ error: 'Failed to fetch residents' }, { status: 500 });
      }

      const ids = Array.from(
        new Set(((scopedRows ?? []) as { resident_id: string }[]).map((r) => r.resident_id))
      );
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, limit });
      }
      residentIdScope = ids;
    }

    let query = supabase
      .from('residents')
      .select(
        'id, full_name, phone, email, national_id_or_iqama, nationality, date_of_birth, university_or_workplace, emergency_contact_name, emergency_contact_phone, profile_image, documents, status, notes, created_at, updated_at',
        { count: 'exact' }
      )
      .order(sortColumn, { ascending: sortAscending });

    // Stable secondary sort.
    if (sortColumn !== 'created_at') {
      query = query.order('created_at', { ascending: false });
    }

    if (residentIdScope) {
      query = query.in('id', residentIdScope);
    }
    if (statusParam && statusParam !== 'all') {
      if (!isResidentStatus(statusParam)) {
        return NextResponse.json({ error: 'invalidStatus' }, { status: 400 });
      }
      query = query.eq('status', statusParam);
    }
    if (nationalityParam) {
      query = query.eq('nationality', nationalityParam);
    }
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,national_id_or_iqama.ilike.%${search}%,university_or_workplace.ilike.%${search}%`
      );
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('Error fetching residents:', error);
      return NextResponse.json({ error: 'Failed to fetch residents' }, { status: 500 });
    }

    const residents = (data || []) as ResidentRow[];
    const residentIds = residents.map((r) => r.id);

    // Fetch the active room_assignments for the page's residents, joined with
    // rooms + buildings, in one round-trip.
    const currentByResident = new Map<string, CurrentAssignment>();
    if (residentIds.length > 0) {
      const { data: assignmentRows, error: assignmentErr } = await supabase
        .from('room_assignments')
        .select(
          'id, resident_id, room_id, building_id, check_in_date, check_out_date, rooms(room_number, floor, apartment_id, apartments(id, apartment_number)), buildings(city_en, city_ar, neighborhood_en, neighborhood_ar)'
        )
        .in('resident_id', residentIds)
        .eq('status', 'active');

      if (assignmentErr) {
        console.error('Error fetching current assignments:', assignmentErr);
        return NextResponse.json({ error: 'Failed to fetch residents' }, { status: 500 });
      }

      for (const row of (assignmentRows || []) as unknown as AssignmentJoinedRow[]) {
        // Only one active assignment per resident is expected; first wins.
        if (currentByResident.has(row.resident_id)) continue;
        currentByResident.set(row.resident_id, {
          id: row.id,
          room_id: row.room_id,
          building_id: row.building_id,
          check_in_date: row.check_in_date,
          check_out_date: row.check_out_date,
          room_number: row.rooms?.room_number ?? null,
          floor: row.rooms?.floor ?? null,
          apartment_id: row.rooms?.apartment_id ?? null,
          apartment_number: row.rooms?.apartments?.apartment_number ?? null,
          building_city_en: row.buildings?.city_en ?? '',
          building_city_ar: row.buildings?.city_ar ?? '',
          building_neighborhood_en: row.buildings?.neighborhood_en ?? '',
          building_neighborhood_ar: row.buildings?.neighborhood_ar ?? '',
        });
      }
    }

    const rows: ResidentListItem[] = residents.map((r) => ({
      ...r,
      current_assignment: currentByResident.get(r.id) ?? null,
    }));

    return NextResponse.json({ data: rows, total: count || 0, page, limit });
  } catch (error) {
    console.error('Residents list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- POST: create a new resident -----

const MAX_NAME = 200;
const MAX_TEXT = 500;
const MAX_NOTES = 5000;
const MAX_PHONE = 30;
const MAX_EMAIL = 254;
const MAX_URL = 1000;

const PHONE_RE = /^\+?[0-9\s-]{6,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/.+/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimStr(v: unknown, max = MAX_TEXT): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normalizePhone(v: unknown, max = MAX_PHONE): string | null {
  const t = trimStr(v, max);
  if (!t) return null;
  if (!PHONE_RE.test(t)) return null;
  const digits = t.replace(/[^0-9]/g, '');
  if (digits.length < 6) return null;
  return t;
}

interface ResidentInsert {
  full_name: string;
  phone: string;
  email: string | null;
  national_id_or_iqama: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  university_or_workplace: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  profile_image: string | null;
  status: ResidentStatus;
  notes: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest('branch_manager', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    if (!hasAdminAccess(profile.role)) {
      // RLS handles insert gating; we still confirm the role has *some* scope
      // for consistency with the GET handler. Inserts don't need a building.
      await getAssignedBuildingIds(profile.id);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalidBody' }, { status: 400 });
    }
    const bodyRec = body as Record<string, unknown>;

    const full_name = trimStr(bodyRec.full_name, MAX_NAME);
    const phoneRaw = trimStr(bodyRec.phone, MAX_PHONE);
    if (!full_name || !phoneRaw) {
      return NextResponse.json({ error: 'requiredFieldsMissing' }, { status: 400 });
    }

    const phone = normalizePhone(bodyRec.phone, MAX_PHONE);
    if (!phone) {
      return NextResponse.json({ error: 'invalidPhone' }, { status: 400 });
    }

    let email: string | null = null;
    if (bodyRec.email != null && bodyRec.email !== '') {
      const e = trimStr(bodyRec.email, MAX_EMAIL);
      if (!e || !EMAIL_RE.test(e)) {
        return NextResponse.json({ error: 'invalidEmail' }, { status: 400 });
      }
      email = e;
    }

    let date_of_birth: string | null = null;
    if (bodyRec.date_of_birth != null && bodyRec.date_of_birth !== '') {
      const d = trimStr(bodyRec.date_of_birth, 20);
      if (!d || !DATE_RE.test(d)) {
        return NextResponse.json({ error: 'invalidDateOfBirth' }, { status: 400 });
      }
      const parsed = new Date(d);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'invalidDateOfBirth' }, { status: 400 });
      }
      const year = parseInt(d.slice(0, 4), 10);
      const currentYear = new Date().getUTCFullYear();
      if (year > currentYear || year < 1900) {
        return NextResponse.json({ error: 'invalidDateOfBirth' }, { status: 400 });
      }
      date_of_birth = d;
    }

    let profile_image: string | null = null;
    if (bodyRec.profile_image != null && bodyRec.profile_image !== '') {
      const u = trimStr(bodyRec.profile_image, MAX_URL);
      if (!u || !URL_RE.test(u)) {
        return NextResponse.json({ error: 'invalidProfileImage' }, { status: 400 });
      }
      profile_image = u;
    }

    let status: ResidentStatus = 'active';
    if (bodyRec.status != null && bodyRec.status !== '') {
      if (!isResidentStatus(bodyRec.status)) {
        return NextResponse.json({ error: 'invalidStatus' }, { status: 400 });
      }
      status = bodyRec.status;
    }

    const national_id_or_iqama = trimStr(bodyRec.national_id_or_iqama, MAX_TEXT);
    const nationality = trimStr(bodyRec.nationality, MAX_TEXT);
    const university_or_workplace = trimStr(bodyRec.university_or_workplace, MAX_TEXT);
    const emergency_contact_name = trimStr(bodyRec.emergency_contact_name, MAX_NAME);

    let emergency_contact_phone: string | null = null;
    if (bodyRec.emergency_contact_phone != null && bodyRec.emergency_contact_phone !== '') {
      const ep = normalizePhone(bodyRec.emergency_contact_phone, MAX_PHONE);
      if (!ep) {
        return NextResponse.json({ error: 'invalidPhone' }, { status: 400 });
      }
      emergency_contact_phone = ep;
    }

    const notes = trimStr(bodyRec.notes, MAX_NOTES);

    // Optional booking linkage. If from_booking_id is supplied, after the
    // resident is created we set booking.metadata.resident_id so the booking
    // detail page can render "View resident" instead of "Convert".
    let from_booking_id: string | null = null;
    if (bodyRec.from_booking_id != null && bodyRec.from_booking_id !== '') {
      const v = trimStr(bodyRec.from_booking_id, 64);
      if (!v || !UUID_RE.test(v)) {
        return NextResponse.json({ error: 'invalidFromBookingId' }, { status: 400 });
      }
      from_booking_id = v;
    }

    const insert: ResidentInsert = {
      full_name,
      phone,
      email,
      national_id_or_iqama,
      nationality,
      date_of_birth,
      university_or_workplace,
      emergency_contact_name,
      emergency_contact_phone,
      profile_image,
      status,
      notes,
    };

    const { data, error } = await supabase
      .from('residents')
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'createFailed' }, { status: 409 });
      }
      console.error('Resident create failed:', error);
      return NextResponse.json({ error: 'createFailed' }, { status: 500 });
    }

    void supabase
      .from('activity_log')
      .insert({
        user_id: profile.id,
        action: 'resident.created',
        entity_type: 'resident',
        entity_id: data.id,
        details: {
          full_name,
          phone,
          status,
          ...(from_booking_id ? { from_booking_id } : {}),
        },
      })
      .then(({ error: logErr }) => {
        if (logErr) console.error('activity_log resident.created:', logErr);
      });

    // Link booking → resident (best-effort). Skips silently if the booking is
    // missing, not completed, or already linked. The resident is already
    // created either way; surface link failures in console only.
    if (from_booking_id) {
      const { data: booking, error: bookingErr } = await supabase
        .from('booking_requests')
        .select('id, status, metadata')
        .eq('id', from_booking_id)
        .maybeSingle<{ id: string; status: string; metadata: Record<string, unknown> | null }>();
      if (bookingErr) {
        console.error('Convert: booking lookup failed:', bookingErr);
      } else if (!booking) {
        console.warn('Convert: from_booking_id not found:', from_booking_id);
      } else {
        const existingResidentId = booking.metadata?.resident_id;
        if (booking.status !== 'completed') {
          console.warn(
            'Convert: booking is not completed; not linking',
            from_booking_id,
            booking.status
          );
        } else if (existingResidentId) {
          console.warn(
            'Convert: booking already linked to resident',
            from_booking_id,
            existingResidentId
          );
        } else {
          const newMetadata = {
            ...(booking.metadata ?? {}),
            resident_id: data.id,
          };
          const { error: updErr } = await supabase
            .from('booking_requests')
            .update({ metadata: newMetadata })
            .eq('id', from_booking_id);
          if (updErr) {
            console.error('Convert: booking metadata update failed:', updErr);
          } else {
            void supabase
              .from('activity_log')
              .insert({
                user_id: profile.id,
                action: 'booking.converted_to_resident',
                entity_type: 'booking_request',
                entity_id: from_booking_id,
                details: { resident_id: data.id },
              })
              .then(({ error: logErr }) => {
                if (logErr)
                  console.error(
                    'activity_log booking.converted_to_resident:',
                    logErr
                  );
              });
          }
        }
      }
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error('Resident create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';
import { revalidatePublicBuildings } from '@/lib/buildings/public';

const SORTABLE_COLUMNS = ['city_en', 'neighborhood_en', 'sort_order', 'created_at', 'updated_at', 'is_active'] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

function isSortColumn(value: unknown): value is SortColumn {
  return typeof value === 'string' && (SORTABLE_COLUMNS as readonly string[]).includes(value);
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

interface RoomCountRow {
  building_id: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
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
    const isActiveParam = searchParams.get('is_active');
    // city is composed into a PostgREST .or() expression below — sanitize so
    // a crafted value like `foo,is_active.eq.true` can't extend the .or()
    // and bypass the intended filter. Same strip set as `search`.
    const city = sanitizeSearch(searchParams.get('city'));
    const search = sanitizeSearch(searchParams.get('search'));
    const limit = Math.min(Math.max(safeInt(searchParams.get('limit'), 25), 1), 100);
    const page = Math.max(safeInt(searchParams.get('page'), 1), 1);
    const offset = (page - 1) * limit;

    const sortParam = searchParams.get('sort');
    const dirParam = searchParams.get('dir');
    const sortColumn: SortColumn = isSortColumn(sortParam) ? sortParam : 'sort_order';
    const sortAscending = dirParam !== 'desc';

    // Scope non-admin-tier roles to their assigned buildings.
    let assignedIds: string[] | null = null;
    if (!hasAdminAccess(profile.role)) {
      assignedIds = await getAssignedBuildingIds(profile.id);
      if (assignedIds.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, limit });
      }
    }

    let query = supabase
      .from('buildings')
      .select(
        'id, slug, city_en, city_ar, neighborhood_en, neighborhood_ar, description_en, description_ar, cover_image, images, map_url, landmarks, is_active, is_placeholder, sort_order, operational_since, created_at, updated_at',
        { count: 'exact' }
      )
      .order(sortColumn, { ascending: sortAscending });

    if (sortColumn !== 'created_at') {
      query = query.order('created_at', { ascending: false });
    }

    if (assignedIds) {
      query = query.in('id', assignedIds);
    }
    if (isActiveParam === 'true' || isActiveParam === 'false') {
      query = query.eq('is_active', isActiveParam === 'true');
    }
    if (city) {
      query = query.or(`city_en.eq.${city},city_ar.eq.${city}`);
    }
    if (search) {
      query = query.or(
        `neighborhood_en.ilike.%${search}%,neighborhood_ar.ilike.%${search}%,city_en.ilike.%${search}%,city_ar.ilike.%${search}%,slug.ilike.%${search}%`
      );
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('Error fetching buildings:', error);
      return NextResponse.json({ error: 'Failed to fetch buildings' }, { status: 500 });
    }

    const buildings = (data || []) as BuildingRow[];
    const buildingIds = buildings.map((b) => b.id);

    // Fetch room status counts for the page's buildings in one round-trip.
    const roomCounts = new Map<string, { total: number; available: number; occupied: number; maintenance: number; reserved: number }>();
    if (buildingIds.length > 0) {
      const { data: roomRows, error: roomErr } = await supabase
        .from('rooms')
        .select('building_id, status')
        .in('building_id', buildingIds);

      if (roomErr) {
        console.error('Error fetching room counts:', roomErr);
        return NextResponse.json({ error: 'Failed to fetch buildings' }, { status: 500 });
      }

      for (const row of (roomRows || []) as RoomCountRow[]) {
        const stats = roomCounts.get(row.building_id) ?? {
          total: 0,
          available: 0,
          occupied: 0,
          maintenance: 0,
          reserved: 0,
        };
        stats.total += 1;
        stats[row.status] += 1;
        roomCounts.set(row.building_id, stats);
      }
    }

    const rows = buildings.map((b) => ({
      ...b,
      room_stats: roomCounts.get(b.id) ?? {
        total: 0,
        available: 0,
        occupied: 0,
        maintenance: 0,
        reserved: 0,
      },
    }));

    return NextResponse.json({ data: rows, total: count || 0, page, limit });
  } catch (error) {
    console.error('Buildings list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ----- POST: create a new building -----

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_RE = /^https?:\/\/.+/i;
const MAX_TEXT = 500;
const MAX_DESC = 5000;
const MAX_LANDMARKS = 20;

interface LandmarkInput {
  name_en?: string;
  name_ar?: string;
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
  if (raw == null) return [];
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
    // Skip fully empty entries; require at least one localized name otherwise.
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

interface BuildingInsert {
  slug: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
  description_en: string;
  description_ar: string;
  map_url: string | null;
  landmarks: LandmarkInput[];
  is_active: boolean;
  is_placeholder: boolean;
  sort_order: number;
  operational_since?: string;
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

    const slug = trimStr((body as Record<string, unknown>).slug, 100);
    const city_en = trimStr((body as Record<string, unknown>).city_en);
    const city_ar = trimStr((body as Record<string, unknown>).city_ar);
    const neighborhood_en = trimStr((body as Record<string, unknown>).neighborhood_en);
    const neighborhood_ar = trimStr((body as Record<string, unknown>).neighborhood_ar);

    if (!slug || !SLUG_RE.test(slug)) {
      return NextResponse.json({ error: 'invalidSlug' }, { status: 400 });
    }
    if (!city_en || !city_ar || !neighborhood_en || !neighborhood_ar) {
      return NextResponse.json({ error: 'requiredFieldsMissing' }, { status: 400 });
    }

    const map_url_raw = (body as Record<string, unknown>).map_url;
    const map_url = trimStr(map_url_raw);
    if (map_url && !URL_RE.test(map_url)) {
      return NextResponse.json({ error: 'invalidMapUrl' }, { status: 400 });
    }

    const landmarks = normalizeLandmarks((body as Record<string, unknown>).landmarks);
    if (landmarks === null) {
      return NextResponse.json({ error: 'invalidLandmarks' }, { status: 400 });
    }

    const sortOrderRaw = (body as Record<string, unknown>).sort_order;
    const sort_order =
      typeof sortOrderRaw === 'number' && Number.isFinite(sortOrderRaw)
        ? Math.trunc(sortOrderRaw)
        : 0;

    const description_en = trimStr((body as Record<string, unknown>).description_en, MAX_DESC) ?? '';
    const description_ar = trimStr((body as Record<string, unknown>).description_ar, MAX_DESC) ?? '';

    const bodyRec = body as Record<string, unknown>;
    let is_active = true;
    if (Object.prototype.hasOwnProperty.call(bodyRec, 'is_active')) {
      if (typeof bodyRec.is_active !== 'boolean') {
        return NextResponse.json({ error: 'invalidIsActive' }, { status: 400 });
      }
      is_active = bodyRec.is_active;
    }
    let is_placeholder = false;
    if (Object.prototype.hasOwnProperty.call(bodyRec, 'is_placeholder')) {
      if (typeof bodyRec.is_placeholder !== 'boolean') {
        return NextResponse.json({ error: 'invalidIsPlaceholder' }, { status: 400 });
      }
      is_placeholder = bodyRec.is_placeholder;
    }

    // operational_since is optional on create — the column has a CURRENT_DATE
    // default. When provided we validate the same way PATCH does so admins
    // can backfill historical buildings with their real online date.
    let operational_since: string | undefined;
    if (Object.prototype.hasOwnProperty.call(bodyRec, 'operational_since')) {
      const v = bodyRec.operational_since;
      if (v === null || (typeof v === 'string' && v.trim() === '')) {
        return NextResponse.json({ error: 'invalidOperationalSince' }, { status: 400 });
      } else if (typeof v === 'string') {
        const t = v.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
          return NextResponse.json({ error: 'invalidOperationalSince' }, { status: 400 });
        }
        const parsed = new Date(t + 'T00:00:00Z');
        // Compare against end-of-today UTC, not Date.now(). A date-only field
        // submitted in early-morning Asia/Riyadh (UTC+3) maps to midnight UTC
        // of the same date, which can be > Date.now() while still being
        // "today" or earlier in the user's locale.
        const endOfTodayUtc = new Date();
        endOfTodayUtc.setUTCHours(23, 59, 59, 999);
        if (Number.isNaN(parsed.getTime()) || parsed.getTime() > endOfTodayUtc.getTime()) {
          return NextResponse.json({ error: 'invalidOperationalSince' }, { status: 400 });
        }
        operational_since = t;
      } else {
        return NextResponse.json({ error: 'invalidOperationalSince' }, { status: 400 });
      }
    }

    const insert: BuildingInsert = {
      slug,
      city_en,
      city_ar,
      neighborhood_en,
      neighborhood_ar,
      description_en,
      description_ar,
      map_url,
      landmarks,
      is_active,
      is_placeholder,
      sort_order,
      ...(operational_since ? { operational_since } : {}),
    };

    const { data, error } = await supabase
      .from('buildings')
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      // Postgres unique violation: 23505
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'slugTaken' }, { status: 409 });
      }
      console.error('Building create failed:', error);
      return NextResponse.json({ error: 'createFailed' }, { status: 500 });
    }

    revalidatePublicBuildings();
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error('Building create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

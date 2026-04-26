import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { createAdminClient } from '@/lib/supabase/admin';

const VALID_ROLES = [
  'super_admin',
  'branch_manager',
  'maintenance_staff',
  'transportation_staff',
  'supervision_staff',
  'finance_staff',
] as const;
type Role = (typeof VALID_ROLES)[number];

const MAX_SEARCH_LEN = 100;
const SEARCH_STRIP_RE = /[,()*"\\]/g;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeInt(val: string | null, fallback: number): number {
  const parsed = parseInt(val || String(fallback));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function sanitizeSearch(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.slice(0, MAX_SEARCH_LEN).replace(SEARCH_STRIP_RE, '');
  return trimmed.trim() || null;
}

function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value);
}

interface AssignmentRow {
  building_id: string;
  buildings: {
    id: string;
    city_en: string;
    city_ar: string;
    neighborhood_en: string;
    neighborhood_ar: string;
  } | null;
}

interface StaffRow {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  staff_building_assignments: AssignmentRow[];
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    if (auth.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const isActiveParam = searchParams.get('is_active');
    const buildingId = searchParams.get('building_id');
    const search = sanitizeSearch(searchParams.get('search'));
    const limit = Math.min(Math.max(safeInt(searchParams.get('limit'), 25), 1), 100);
    const page = Math.max(safeInt(searchParams.get('page'), 1), 1);
    const offset = (page - 1) * limit;

    const admin = createAdminClient();

    // Fetch the auth.users → email map up-front. perPage caps at 1000 (Supabase
    // hard limit); a staff portal of <100 users is comfortably within one page.
    const { data: authList, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) {
      console.error('Error fetching auth users:', authErr);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
    const emailById = new Map<string, string>();
    for (const u of authList.users) {
      if (u.email) emailById.set(u.id, u.email);
    }

    // If filtering by building, get matching staff IDs first.
    let buildingFilteredIds: string[] | null = null;
    if (buildingId) {
      const { data: rows, error } = await admin
        .from('staff_building_assignments')
        .select('staff_id')
        .eq('building_id', buildingId);
      if (error) {
        console.error('Building filter lookup failed:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
      }
      buildingFilteredIds = (rows || []).map((r: { staff_id: string }) => r.staff_id);
      if (buildingFilteredIds.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, limit });
      }
    }

    // Email search: if the query looks like (or contains) an email, resolve
    // matching staff IDs from the auth-users map, then constrain the DB query
    // by id. Falls back to a name-prefix search otherwise.
    let emailFilteredIds: string[] | null = null;
    const isEmailSearch = !!search && search.includes('@');
    if (isEmailSearch) {
      const needle = search.toLowerCase();
      emailFilteredIds = [];
      for (const [id, email] of emailById) {
        if (email.toLowerCase().includes(needle)) emailFilteredIds.push(id);
      }
      if (emailFilteredIds.length === 0) {
        return NextResponse.json({ data: [], total: 0, page, limit });
      }
    }

    let query = admin
      .from('staff_profiles')
      .select(
        'id, full_name, phone, role, is_active, created_at, updated_at, staff_building_assignments(building_id, buildings(id, city_en, city_ar, neighborhood_en, neighborhood_ar))',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (role && isValidRole(role)) {
      query = query.eq('role', role);
    }
    if (isActiveParam === 'true' || isActiveParam === 'false') {
      query = query.eq('is_active', isActiveParam === 'true');
    }
    if (buildingFilteredIds) {
      query = query.in('id', buildingFilteredIds);
    }
    if (emailFilteredIds) {
      query = query.in('id', emailFilteredIds);
    } else if (search) {
      query = query.ilike('full_name', `%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const rows = (data as unknown as StaffRow[]).map((row) => ({
      id: row.id,
      email: emailById.get(row.id) ?? null,
      full_name: row.full_name,
      phone: row.phone,
      role: row.role,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      buildings: (row.staff_building_assignments || [])
        .filter((a) => a.buildings)
        .map((a) => ({
          id: a.buildings!.id,
          city_en: a.buildings!.city_en,
          city_ar: a.buildings!.city_ar,
          neighborhood_en: a.buildings!.neighborhood_en,
          neighborhood_ar: a.buildings!.neighborhood_ar,
        })),
    }));

    return NextResponse.json({ data: rows, total: count || 0, page, limit });
  } catch (error) {
    console.error('Users list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    if (auth.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
    const role = body.role;
    const buildingIds: string[] = Array.isArray(body.building_ids)
      ? body.building_ids.filter((v: unknown): v is string => typeof v === 'string')
      : [];

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }
    if (!isValidRole(role)) {
      return NextResponse.json({ error: 'invalidRole' }, { status: 400 });
    }

    const admin = createAdminClient();
    // Source the redirect from a trusted env var only. Using the request Origin
    // would let a caller (super_admin or compromised account) point invitation
    // links at an attacker domain if Supabase's redirect-URL allowlist is loose.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const redirectTo = siteUrl ? `${siteUrl}/ar/admin/login` : undefined;

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (inviteErr || !invited?.user) {
      // Supabase returns code 'email_exists' (status 422) when the address is
      // already registered. Fall back to message text for older SDKs.
      const code = (inviteErr as { code?: string } | null)?.code;
      const status = (inviteErr as { status?: number } | null)?.status;
      const msg = inviteErr?.message || '';
      if (code === 'email_exists' || status === 422 || /already.*registered|email.*exists/i.test(msg)) {
        return NextResponse.json({ error: 'emailExists' }, { status: 409 });
      }
      console.error('Invite failed:', inviteErr);
      return NextResponse.json({ error: 'inviteFailed' }, { status: 500 });
    }

    const newId = invited.user.id;

    try {
      const { error: profileErr } = await admin.from('staff_profiles').insert({
        id: newId,
        full_name: fullName,
        phone,
        role,
        is_active: true,
      });
      if (profileErr) throw profileErr;

      if (role !== 'super_admin' && buildingIds.length > 0) {
        const rows = buildingIds.map((building_id) => ({ staff_id: newId, building_id }));
        const { error: assignErr } = await admin.from('staff_building_assignments').insert(rows);
        if (assignErr) throw assignErr;
      }
    } catch (err) {
      console.error('Post-invite setup failed; rolling back auth user:', err);
      const { error: cleanupErr } = await admin.auth.admin.deleteUser(newId);
      if (cleanupErr) {
        console.error('Cleanup failed — orphan auth user:', newId, cleanupErr);
      }
      return NextResponse.json({ error: 'inviteFailed' }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: newId,
        email,
        full_name: fullName,
        phone,
        role,
        is_active: true,
        building_ids: role === 'super_admin' ? [] : buildingIds,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('User invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

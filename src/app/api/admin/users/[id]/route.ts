import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { createAdminClient } from '@/lib/supabase/admin';

const VALID_ROLES = [
  'super_admin',
  'deputy_general_manager',
  'branch_manager',
  'maintenance_manager',
  'transportation_manager',
  'finance_manager',
  'maintenance_staff',
  'transportation_staff',
  'supervision_staff',
  'finance_staff',
] as const;
type Role = (typeof VALID_ROLES)[number];

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

async function loadUser(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data, error } = await admin
    .from('staff_profiles')
    .select(
      'id, full_name, phone, role, is_active, created_at, updated_at, staff_building_assignments(building_id, buildings(id, city_en, city_ar, neighborhood_en, neighborhood_ar))'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as StaffRow;

  const { data: authUser } = await admin.auth.admin.getUserById(id);
  return {
    id: row.id,
    email: authUser?.user?.email ?? null,
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
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    if (auth.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const admin = createAdminClient();
    const user = await loadUser(admin, id);
    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error('User fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    if (auth.profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: existing, error: fetchErr } = await admin
      .from('staff_profiles')
      .select('id, role, is_active')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) {
      console.error('User lookup failed:', fetchErr);
      return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Self-protection: a user cannot change their own role or active state.
    const isSelf = id === auth.user.id;
    const touchesRole = Object.prototype.hasOwnProperty.call(body, 'role');
    const touchesActive = Object.prototype.hasOwnProperty.call(body, 'is_active');
    if (isSelf && (touchesRole || touchesActive)) {
      return NextResponse.json({ error: 'selfModify' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.full_name === 'string' && body.full_name.trim()) {
      updates.full_name = body.full_name.trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'phone')) {
      const p = body.phone;
      updates.phone = typeof p === 'string' && p.trim() ? p.trim() : null;
    }
    let nextRole: Role = existing.role as Role;
    if (touchesRole) {
      if (!isValidRole(body.role)) {
        return NextResponse.json({ error: 'invalidRole' }, { status: 400 });
      }
      updates.role = body.role;
      nextRole = body.role;
    }
    let nextActive: boolean = existing.is_active;
    if (touchesActive) {
      nextActive = body.is_active === true;
      updates.is_active = nextActive;
    }

    // Last super_admin safeguard.
    const wouldRemoveSuperAdmin =
      existing.role === 'super_admin' &&
      ((touchesRole && nextRole !== 'super_admin') || (touchesActive && nextActive === false));
    if (wouldRemoveSuperAdmin) {
      const { count, error: countErr } = await admin
        .from('staff_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin')
        .eq('is_active', true);
      if (countErr) {
        console.error('Super admin count failed:', countErr);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
      }
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'lastSuperAdmin' }, { status: 400 });
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await admin.from('staff_profiles').update(updates).eq('id', id);
      if (updErr) {
        // The DB trigger `protect_last_super_admin` raises `last_super_admin`
        // when an update would empty the active super_admin pool. This is the
        // race-safe backstop for the application-level check above.
        if (updErr.message?.includes('last_super_admin')) {
          return NextResponse.json({ error: 'lastSuperAdmin' }, { status: 400 });
        }
        console.error('User update failed:', updErr);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
      }
    }

    // Building assignments — replace if provided. When the (new) role is
    // super_admin or deputy_general_manager, drop assignments entirely (admin
    // tier sees all buildings via has_admin_access RLS).
    const nextRoleSkipsAssignments =
      nextRole === 'super_admin' || nextRole === 'deputy_general_manager';
    if (Array.isArray(body.building_ids) || (touchesRole && nextRoleSkipsAssignments)) {
      const ids: string[] = Array.isArray(body.building_ids)
        ? body.building_ids.filter((v: unknown): v is string => typeof v === 'string')
        : [];

      const { error: delErr } = await admin
        .from('staff_building_assignments')
        .delete()
        .eq('staff_id', id);
      if (delErr) {
        console.error('Assignment clear failed:', delErr);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
      }

      if (!nextRoleSkipsAssignments && ids.length > 0) {
        const rows = ids.map((building_id) => ({ staff_id: id, building_id }));
        const { error: insErr } = await admin.from('staff_building_assignments').insert(rows);
        if (insErr) {
          console.error('Assignment insert failed:', insErr);
          return NextResponse.json({ error: 'Failed' }, { status: 500 });
        }
      }
    }

    const fresh = await loadUser(admin, id);
    return NextResponse.json(fresh);
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Hard delete not allowed. Deactivate instead.' },
    { status: 405 }
  );
}

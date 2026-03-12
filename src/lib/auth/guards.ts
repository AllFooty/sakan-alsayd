import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from './providers';

export async function getAuthenticatedStaff(locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/admin/login`);
  }

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect(`/${locale}/admin/login`);
  }

  return { user, profile };
}

export async function requireRole(locale: string, ...roles: UserRole[]) {
  const { user, profile } = await getAuthenticatedStaff(locale);

  if (!roles.includes(profile.role)) {
    redirect(`/${locale}/admin`);
  }

  return { user, profile };
}

export async function getAssignedBuildingIds(staffId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('staff_building_assignments')
    .select('building_id')
    .eq('staff_id', staffId);

  return data?.map((row: { building_id: string }) => row.building_id) ?? [];
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === 'super_admin';
}

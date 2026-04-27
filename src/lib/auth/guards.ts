import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserRole, StaffProfile } from './types';

// `cache()` memoizes within a single request: multiple server components
// calling getAuthenticatedStaff during the same RSC render share one
// staff_profiles fetch.
export const getAuthenticatedStaff = cache(async (locale: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/admin/login`);
  }

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('id, full_name, phone, role, is_active')
    .eq('id', user.id)
    .single<StaffProfile>();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect(`/${locale}/admin/login`);
  }

  return { user, profile };
});

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

export function hasAdminAccess(role: UserRole): boolean {
  return role === 'super_admin' || role === 'deputy_general_manager';
}

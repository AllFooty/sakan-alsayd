import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { UserRole, StaffProfile } from './providers';

interface AuthResult {
  user: { id: string; email?: string };
  profile: StaffProfile;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Authenticate an API request and verify the user has an active staff profile.
 * Optionally restrict to specific roles. super_admin and deputy_general_manager
 * always pass (deputy is a super_admin peer for everything except user mgmt;
 * the user-management API enforces the super_admin-only check itself).
 * Returns { user, profile, supabase } on success, or a NextResponse error.
 */
export async function authenticateApiRequest(
  ...allowedRoles: UserRole[]
): Promise<AuthResult | NextResponse> {
  const supabase = await createClient();

  // Use getSession() instead of getUser() — the middleware already called getUser()
  // to refresh the session, so the cookie-based session is trustworthy here.
  // This avoids an extra network round-trip to Supabase on every API call.
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  if (authError || !session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user;

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: 'Forbidden: inactive account' }, { status: 403 });
  }

  // If roles specified, check membership. super_admin and deputy_general_manager
  // always pass; the user-management API does an additional super_admin-only check.
  const isAdminTier = profile.role === 'super_admin' || profile.role === 'deputy_general_manager';
  if (allowedRoles.length > 0 && !isAdminTier && !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
  }

  return { user: { id: user.id, email: user.email }, profile, supabase };
}

/** Type guard to check if the result is an error response */
export function isAuthError(result: AuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

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
 * Optionally restrict to specific roles. super_admin always passes.
 * Returns { user, profile, supabase } on success, or a NextResponse error.
 */
export async function authenticateApiRequest(
  ...allowedRoles: UserRole[]
): Promise<AuthResult | NextResponse> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: 'Forbidden: inactive account' }, { status: 403 });
  }

  // If roles specified, check membership (super_admin always passes)
  if (allowedRoles.length > 0 && profile.role !== 'super_admin' && !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden: insufficient role' }, { status: 403 });
  }

  return { user: { id: user.id, email: user.email }, profile, supabase };
}

/** Type guard to check if the result is an error response */
export function isAuthError(result: AuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

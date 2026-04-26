import { NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  _request: Request,
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

    const { data: target, error: lookupErr } = await admin.auth.admin.getUserById(id);
    if (lookupErr || !target?.user?.email) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const redirectTo = siteUrl ? `${siteUrl}/ar/admin/login` : undefined;

    const { error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: target.user.email,
      options: { redirectTo },
    });
    if (error) {
      console.error('Recovery link failed:', error);
      return NextResponse.json({ error: 'Failed to send reset' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

const VALID_THEMES = ['light', 'dark', 'system'] as const;
type Theme = (typeof VALID_THEMES)[number];

export async function PATCH(req: Request) {
  const auth = await authenticateApiRequest();
  if (isAuthError(auth)) return auth;
  const { user, supabase } = auth;

  let body: { theme?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const theme = body.theme;
  if (!VALID_THEMES.includes(theme as Theme)) {
    return NextResponse.json(
      { error: `theme must be one of ${VALID_THEMES.join(', ')}` },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from('staff_profiles')
    .update({ theme_preference: theme })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, theme });
}

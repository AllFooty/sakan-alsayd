import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { locales, defaultLocale } from '@/i18n/config';

// Derive the locale from the `next` path so the callback redirects users
// back to the locale they started in (rather than always the default).
function localeFromNext(next: string): string {
  for (const loc of locales) {
    if (next === `/${loc}` || next.startsWith(`/${loc}/`)) return loc;
  }
  return defaultLocale;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? `/${defaultLocale}/admin`;
  const locale = localeFromNext(next);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/admin/login?error=auth`);
}

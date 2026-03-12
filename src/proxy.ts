import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { locales, defaultLocale } from './i18n/config';
import { updateSession } from './lib/supabase/middleware';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: false,
});

function isAdminRoute(pathname: string): boolean {
  return locales.some(
    (locale) =>
      pathname.startsWith(`/${locale}/admin`) &&
      !pathname.startsWith(`/${locale}/admin/login`)
  );
}

function isAdminLoginRoute(pathname: string): boolean {
  return locales.some((locale) =>
    pathname.startsWith(`/${locale}/admin/login`)
  );
}

function getLocaleFromPath(pathname: string): string {
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale;
    }
  }
  return defaultLocale;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Run intl middleware first for locale handling
  const intlResponse = intlMiddleware(request);

  // Check if this is an admin route (not login)
  if (isAdminRoute(pathname)) {
    const { user, supabaseResponse } = await updateSession(request);

    if (!user) {
      const locale = getLocaleFromPath(pathname);
      const loginUrl = new URL(`/${locale}/admin/login`, request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Copy intl headers/cookies to supabase response
    intlResponse.headers.forEach((value, key) => {
      supabaseResponse.headers.set(key, value);
    });

    return supabaseResponse;
  }

  // For admin login, just pass through (no auth check needed)
  if (isAdminLoginRoute(pathname)) {
    return intlResponse;
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};

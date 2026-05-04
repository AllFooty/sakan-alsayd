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

// /admin/* routes that don't require an authenticated session.
const ADMIN_PUBLIC_SUFFIXES = ['/admin/login', '/admin/forgot-password', '/admin/reset-password'];

// Match a public-admin suffix at the END of a path segment — i.e. exactly the
// suffix, the suffix followed by `/`, or the suffix followed by `?`. Plain
// `pathname.startsWith(prefix)` would also match `/ar/admin/login-bypass`,
// silently exposing a sibling route under the same prefix to unauthenticated
// users.
function pathMatchesPublicSuffix(pathname: string): boolean {
  for (const locale of locales) {
    for (const suffix of ADMIN_PUBLIC_SUFFIXES) {
      const full = `/${locale}${suffix}`;
      if (pathname === full) return true;
      if (pathname.startsWith(`${full}/`)) return true;
      if (pathname.startsWith(`${full}?`)) return true;
    }
  }
  return false;
}

function isAdminRoute(pathname: string): boolean {
  return locales.some((locale) => {
    if (!pathname.startsWith(`/${locale}/admin`)) return false;
    return !pathMatchesPublicSuffix(pathname);
  });
}

function isAdminPublicRoute(pathname: string): boolean {
  return pathMatchesPublicSuffix(pathname);
}

function getLocaleFromPath(pathname: string): string {
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale;
    }
  }
  return defaultLocale;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes already always carry the locale prefix in the URL, so
  // next-intl's middleware has nothing to add for them. Running it here
  // triggered a redirect-to-self loop on Next 16. Bypass it for /admin/*
  // and only run the Supabase session check.
  if (isAdminRoute(pathname)) {
    const { user, supabaseResponse } = await updateSession(request);

    if (!user) {
      const locale = getLocaleFromPath(pathname);
      const loginUrl = new URL(`/${locale}/admin/login`, request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
  }

  if (isAdminPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Public routes: run next-intl middleware for locale routing.
  return intlMiddleware(request);
}

// Stays as `middleware.ts` (not the Next 16 `proxy.ts` convention) because
// opennextjs-cloudflare 1.17 requires Edge-runtime middleware, while Next
// 16's `proxy.ts` is Node-runtime-only. The deprecation warning on every
// `next build` is the lesser evil; revisit once either side closes the gap.
export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};

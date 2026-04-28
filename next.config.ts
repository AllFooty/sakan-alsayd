import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't pick the parent /Users/mubdu
  // package-lock.json over our own. import.meta.dirname is Node ≥ 20.11.
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Default Next 16 deviceSizes go up to 3840 (4K). Largest image we
    // actually display at full width is the page background of the building
    // detail hero, capped at 1920 in the Tailwind container. Drop the 2048
    // and 3840 variants so the browser preload stops requesting them.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Whitelist the few quality levels we actually use; 70 is the default
    // baseline for photos (visually identical to 75 at 5–10% smaller bytes),
    // 90 stays available if a future photo needs it.
    qualities: [70, 90],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cloudflareinsights.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');

    const isDev = process.env.NODE_ENV !== 'production';

    const baseHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: csp },
    ];

    // HSTS only applies in production. In dev, the dev server speaks plain
    // HTTP — sending HSTS pins browsers to HTTPS for two years and breaks
    // localhost until the user manually clears the policy.
    if (!isDev) {
      baseHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }

    return [
      {
        source: '/(.*)',
        headers: baseHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);

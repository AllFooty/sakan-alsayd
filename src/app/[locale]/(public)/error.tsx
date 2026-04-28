'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Header, Footer } from '@/components/layout';
import { Button } from '@/components/ui';

// Last-resort boundary for the public marketing site (home, building detail,
// testimonials). The (public) layout's Supabase fetches are wrapped in
// try/catch, so this generally only triggers on client-side render errors.
// We intentionally do NOT show `error.message` to the user — it can leak
// internals. The `digest` is logged to console.error so it surfaces in
// Cloudflare Workers logs and can be cross-referenced with the user report.
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const locale = useLocale();

  useEffect(() => {
    console.error('[public error boundary]', {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <>
      <Header />
      <main className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="bg-cream rounded-3xl p-8 md:p-12 max-w-lg w-full text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-coral mb-3">
            {t('title')}
          </h1>
          <p className="text-navy/70 mb-8">
            {t('subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="primary" onClick={reset}>
              {t('tryAgain')}
            </Button>
            <Link href={`/${locale}`} className="inline-flex">
              <Button variant="secondary" className="w-full sm:w-auto">
                {t('goHome')}
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

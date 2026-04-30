'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';

// Last-resort boundary for the authenticated admin shell. We deliberately
// avoid rendering AdminShell here — that component depends on AuthProvider
// context and any number of staff hooks that may have crashed alongside the
// page. A bare card keeps this resilient to upstream failures. `digest` is
// logged to console.error so it surfaces in Cloudflare Workers logs.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error('[admin error boundary]', {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 bg-white dark:bg-[var(--admin-surface)]">
      <div className="bg-cream rounded-3xl p-8 md:p-12 max-w-lg w-full text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-coral mb-3">
          {t('title')}
        </h1>
        <p className="text-navy/70 mb-8">
          {t('subtitle')}
        </p>
        <Button variant="primary" onClick={reset}>
          {t('tryAgain')}
        </Button>
      </div>
    </main>
  );
}

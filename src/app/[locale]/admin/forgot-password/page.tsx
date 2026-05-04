'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export default function ForgotPasswordPage() {
  return (
    <ThemeProvider>
      <ForgotPasswordForm />
    </ThemeProvider>
  );
}

function ForgotPasswordForm() {
  const locale = useLocale();
  const t = useTranslations('admin.forgotPassword');
  const tLogin = useTranslations('admin.login');
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Always show the same success state regardless of API result so we
    // don't leak whether the email exists. Errors here are intentionally
    // swallowed; Supabase rate-limits enumeration attempts on its side.
    try {
      const redirectTo = `${window.location.origin}/${locale}/admin/reset-password`;
      await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-[var(--admin-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/logo-horizontal.png"
            alt="Sakan Alsayd"
            width={200}
            height={60}
            className="mx-auto h-12 w-auto dark:hidden"
          />
          <Image
            src="/logo-white.png"
            alt="Sakan Alsayd"
            width={200}
            height={60}
            className="mx-auto h-12 w-auto hidden dark:block"
          />
          <h1 className="text-xl font-bold text-navy dark:text-[var(--admin-text)] mt-4">
            {t('title')}
          </h1>
          <p className="text-gray-500 dark:text-[var(--admin-text-muted)] text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>

        <div className="bg-white dark:bg-[var(--admin-surface)] rounded-2xl shadow-lg p-6 md:p-8">
          {submitted ? (
            <div className="text-center space-y-4" role="status">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle size={24} />
              </div>
              <h2 className="text-lg font-semibold text-navy dark:text-[var(--admin-text)]">
                {t('successTitle')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-[var(--admin-text-muted)]">
                {t('successBody')}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1.5"
                >
                  {t('emailLabel')}
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-[var(--admin-text-subtle)]"
                    style={locale === 'ar' ? { right: 12 } : { left: 12 }}
                  />
                  <input
                    id="email"
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="test@sakanalsayd.com"
                    className="w-full rounded-xl border border-gray-300 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface-2)] text-navy dark:text-[var(--admin-text)] py-3 text-base focus:ring-2 focus:ring-coral focus:border-coral outline-none transition-colors placeholder:text-gray-300 dark:placeholder:text-[var(--admin-text-subtle)] placeholder:italic"
                    style={
                      locale === 'ar'
                        ? { paddingRight: 40, paddingLeft: 16 }
                        : { paddingLeft: 40, paddingRight: 16 }
                    }
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.includes('@')}
                className="w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 shadow-md shadow-coral/20"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : t('submit')}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-6">
          <a
            href={`/${locale}/admin/login`}
            className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)] hover:text-coral transition-colors"
          >
            {tLogin('backToLogin')}
          </a>
        </p>
      </div>
    </div>
  );
}

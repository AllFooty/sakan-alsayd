'use client';

import { Suspense, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

// Skip prerender — Next 16 was emitting a 307-to-self for this route
// during static generation, causing a redirect loop on /admin/login.
import Image from 'next/image';
import { Mail, Lock, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { classifyAuthError } from '@/lib/errors/auth';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

type Step = 'email' | 'otp';

const isDev = process.env.NODE_ENV === 'development';

function LoginSkeleton() {
  return (
    <div className="min-h-screen bg-cream dark:bg-[var(--admin-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="h-12 w-48 bg-gray-200 dark:bg-[var(--admin-surface-2)] rounded animate-pulse mx-auto" />
          <div className="h-6 w-40 bg-gray-200 dark:bg-[var(--admin-surface-2)] rounded animate-pulse mx-auto mt-4" />
        </div>
        <div className="bg-white dark:bg-[var(--admin-surface)] rounded-2xl shadow-lg p-8">
          <div className="space-y-5">
            <div className="h-5 w-24 bg-gray-200 dark:bg-[var(--admin-surface-2)] rounded animate-pulse" />
            <div className="h-12 bg-gray-200 dark:bg-[var(--admin-surface-2)] rounded-xl animate-pulse" />
            <div className="h-12 bg-gray-200 dark:bg-[var(--admin-surface-2)] rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <ThemeProvider>
      <Suspense fallback={<LoginSkeleton />}>
        <LoginForm />
      </Suspense>
    </ThemeProvider>
  );
}

function LoginForm() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usePassword, setUsePassword] = useState(isDev);
  const [showPassword, setShowPassword] = useState(false);

  const locale = useLocale();
  const t = useTranslations('admin.login');
  const searchParams = useSearchParams();
  const rawRedirectTo = searchParams.get('redirectTo');
  const isSafeAdminPath = (path: string | null): path is string =>
    !!path && /^\/(ar|en)\/admin(\/|$|\?)/.test(path);
  const redirectTo = isSafeAdminPath(rawRedirectTo) ? rawRedirectTo : `/${locale}/admin`;
  const supabase = createClient();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(t(`errors.${classifyAuthError(error)}`));
        setLoading(false);
      } else {
        window.location.href = redirectTo;
      }
    } catch (err) {
      setError(t(`errors.${classifyAuthError(err)}`));
      setLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });

      if (error) {
        setError(t(`errors.${classifyAuthError(error)}`));
      } else {
        setStep('otp');
      }
    } catch (err) {
      setError(t(`errors.${classifyAuthError(err)}`));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp,
        type: 'email',
      });

      if (error) {
        setError(t(`errors.${classifyAuthError(error)}`));
        setLoading(false);
      } else {
        window.location.href = redirectTo;
      }
    } catch (err) {
      setError(t(`errors.${classifyAuthError(err)}`));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-[var(--admin-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
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
          <p className="text-gray-500 dark:text-[var(--admin-text-muted)] text-sm mt-1">{t('subtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[var(--admin-surface)] rounded-2xl shadow-lg p-6 md:p-8">
          {step === 'email' ? (
            <form
              onSubmit={usePassword ? handlePasswordLogin : handleSendOtp}
              className="space-y-5"
            >
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

              {usePassword && (
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1.5"
                  >
                    {t('passwordLabel')}
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-[var(--admin-text-subtle)]"
                      style={locale === 'ar' ? { right: 12 } : { left: 12 }}
                    />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-gray-300 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface-2)] text-navy dark:text-[var(--admin-text)] py-3 text-base focus:ring-2 focus:ring-coral focus:border-coral outline-none transition-colors"
                      style={
                        locale === 'ar'
                          ? { paddingRight: 40, paddingLeft: 40 }
                          : { paddingLeft: 40, paddingRight: 40 }
                      }
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-[var(--admin-text-subtle)] hover:text-gray-600 dark:hover:text-[var(--admin-text)] transition-colors"
                      style={locale === 'ar' ? { left: 12 } : { right: 12 }}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg p-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  !email.includes('@') ||
                  (usePassword && !password)
                }
                className="w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 shadow-md shadow-coral/20"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : usePassword ? (
                  t('signIn')
                ) : (
                  t('sendOtp')
                )}
              </button>

              <button
                type="button"
                onClick={() => setUsePassword(!usePassword)}
                className="w-full text-xs text-gray-400 dark:text-[var(--admin-text-subtle)] hover:text-coral transition-colors"
              >
                {usePassword ? t('switchToOtp') : t('switchToPassword')}
              </button>

              {usePassword && (
                <p className="text-center">
                  <a
                    href={`/${locale}/admin/forgot-password`}
                    className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] hover:text-coral transition-colors"
                  >
                    {t('forgotPassword')}
                  </a>
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setError('');
                }}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-[var(--admin-text-muted)] hover:text-navy dark:hover:text-[var(--admin-text)] transition-colors"
              >
                <ArrowLeft size={16} />
                {t('backToEmail')}
              </button>

              <p className="text-sm text-gray-600 dark:text-[var(--admin-text-muted)]">
                {t('otpSent', { email })}
              </p>

              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1.5"
                >
                  {t('otpLabel')}
                </label>
                <input
                  id="otp"
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className="w-full rounded-xl border border-gray-300 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface-2)] text-navy dark:text-[var(--admin-text)] py-3 px-4 text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-coral focus:border-coral outline-none transition-colors"
                  maxLength={6}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg p-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 shadow-md shadow-coral/20"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  t('verify')
                )}
              </button>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full text-sm text-gray-500 dark:text-[var(--admin-text-muted)] hover:text-coral transition-colors"
              >
                {t('resendOtp')}
              </button>
            </form>
          )}
        </div>

        {/* Back to website */}
        <p className="text-center mt-6">
          <a
            href={`/${locale}`}
            className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)] hover:text-coral transition-colors"
          >
            {t('backToWebsite')}
          </a>
        </p>
      </div>
    </div>
  );
}

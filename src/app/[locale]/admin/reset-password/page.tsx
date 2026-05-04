'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Lock, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

const MIN_LEN = 12;
const LETTER_RE = /[A-Za-z]/;
const DIGIT_RE = /\d/;

type ErrorKey = 'tooShort' | 'needsLetterAndDigit' | 'mismatch' | 'noSession' | 'unknown';

function validatePassword(pw: string): ErrorKey | null {
  if (pw.length < MIN_LEN) return 'tooShort';
  if (!LETTER_RE.test(pw) || !DIGIT_RE.test(pw)) return 'needsLetterAndDigit';
  return null;
}

export default function ResetPasswordPage() {
  return (
    <ThemeProvider>
      <ResetPasswordForm />
    </ThemeProvider>
  );
}

function ResetPasswordForm() {
  const locale = useLocale();
  const t = useTranslations('admin.resetPassword');
  const tLogin = useTranslations('admin.login');
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);

  // Supabase delivers the recovery session via the URL fragment when the
  // user clicks the email link. The auth-js client reads it on mount and
  // emits PASSWORD_RECOVERY shortly after; we accept either an existing
  // session OR that explicit event.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setHasSession(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(true);
      }
    });
    // Give the client a beat to surface the recovery session before we
    // decide there isn't one.
    const timer = setTimeout(() => {
      setHasSession((prev) => (prev === null ? false : prev));
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorKey(null);
    const pwError = validatePassword(password);
    if (pwError) {
      setErrorKey(pwError);
      return;
    }
    if (password !== confirm) {
      setErrorKey('mismatch');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorKey(error.message?.toLowerCase().includes('session') ? 'noSession' : 'unknown');
        setLoading(false);
        return;
      }
      // Sign the user out so they have to re-login with the new password.
      await supabase.auth.signOut();
      setSubmitted(true);
    } catch {
      setErrorKey('unknown');
    } finally {
      setLoading(false);
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
              <a
                href={`/${locale}/admin/login`}
                className="inline-flex items-center justify-center w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark transition-colors mt-2"
              >
                {t('goToLogin')}
              </a>
            </div>
          ) : hasSession === false ? (
            <div className="text-center space-y-4" role="alert">
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg p-3">
                {t('errors.noSession')}
              </p>
              <a
                href={`/${locale}/admin/forgot-password`}
                className="inline-flex items-center justify-center w-full bg-coral text-white font-semibold py-3 rounded-xl hover:bg-coral-dark transition-colors"
              >
                {t('submit')}
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <PasswordField
                id="new-password"
                label={t('newPasswordLabel')}
                value={password}
                onChange={setPassword}
                show={showPassword}
                onToggleShow={() => setShowPassword((s) => !s)}
                locale={locale}
                autoComplete="new-password"
              />
              <PasswordField
                id="confirm-password"
                label={t('confirmPasswordLabel')}
                value={confirm}
                onChange={setConfirm}
                show={showPassword}
                onToggleShow={() => setShowPassword((s) => !s)}
                locale={locale}
                autoComplete="new-password"
              />

              {errorKey && (
                <p
                  className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg p-3"
                  role="alert"
                >
                  {t(`errors.${errorKey}`)}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirm || hasSession !== true}
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

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  locale,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  locale: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <Lock
          size={18}
          className="absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-[var(--admin-text-subtle)]"
          style={locale === 'ar' ? { right: 12 } : { left: 12 }}
        />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder="••••••••"
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
          onClick={onToggleShow}
          className="absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-[var(--admin-text-subtle)] hover:text-gray-600 dark:hover:text-[var(--admin-text)] transition-colors"
          style={locale === 'ar' ? { left: 12 } : { right: 12 }}
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

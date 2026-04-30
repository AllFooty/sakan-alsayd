'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Settings, ShieldCheck, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth/hooks';
import EmptyState from '@/components/admin/shared/EmptyState';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';

export default function SettingsPage() {
  const t = useTranslations('admin');
  const tSettings = useTranslations('admin.settings');
  const tCard = useTranslations('admin.settings.cards.rolesPermissions');
  const locale = useLocale();
  const { profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  const isSuperAdmin = profile?.role === 'super_admin';

  if (!isSuperAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-navy dark:text-[var(--admin-text)]">{t('sidebar.settings')}</h1>
        <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)]">
          <EmptyState
            icon={Settings}
            title={t('comingSoon.title')}
            description={t('comingSoon.description')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy dark:text-[var(--admin-text)]">{tSettings('title')}</h1>
        <p className="text-gray-500 dark:text-[var(--admin-text-muted)] mt-1">{tSettings('subtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/${locale}/admin/settings/roles-permissions`}
          className="group flex items-start gap-3 rounded-xl border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] p-4 hover:border-coral hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-coral/10 text-coral flex items-center justify-center shrink-0">
            <ShieldCheck size={20} aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-navy dark:text-[var(--admin-text)] group-hover:text-coral transition-colors">
                {tCard('title')}
              </h3>
              <ChevronRight
                size={16}
                className="text-gray-400 dark:text-[var(--admin-text-subtle)] group-hover:text-coral rtl:rotate-180 transition-colors shrink-0"
                aria-hidden
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-1 leading-relaxed">
              {tCard('description')}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

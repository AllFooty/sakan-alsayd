'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/hooks';
import { FileText } from 'lucide-react';
import EmptyState from '@/components/admin/shared/EmptyState';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';

export default function ContentPage() {
  const t = useTranslations('admin');
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy dark:text-[var(--admin-text)]">{t('sidebar.content')}</h1>
      <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)]">
        <EmptyState
          icon={FileText}
          title={t('comingSoon.title')}
          description={t('comingSoon.description')}
        />
      </div>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/hooks';
import { Users } from 'lucide-react';
import EmptyState from '@/components/admin/shared/EmptyState';

export default function ResidentsPage() {
  const t = useTranslations('admin');
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">{t('sidebar.residents')}</h1>
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState
          icon={Users}
          title={t('comingSoon.title')}
          description={t('comingSoon.description')}
        />
      </div>
    </div>
  );
}

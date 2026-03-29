'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/hooks';
import { Building2 } from 'lucide-react';
import EmptyState from '@/components/admin/shared/EmptyState';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';

export default function BuildingsPage() {
  const t = useTranslations('admin');
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">{t('sidebar.buildings')}</h1>
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState
          icon={Building2}
          title={t('comingSoon.title')}
          description={t('comingSoon.description')}
        />
      </div>
    </div>
  );
}

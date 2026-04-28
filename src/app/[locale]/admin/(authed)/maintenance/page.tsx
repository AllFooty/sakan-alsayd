'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/hooks';
import MaintenanceList from '@/components/admin/maintenance/MaintenanceList';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';

export default function MaintenancePage() {
  const t = useTranslations('admin.maintenance');
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      <MaintenanceList />
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import EmptyState from '@/components/admin/shared/EmptyState';
import RolesPermissionsMatrix from '@/components/admin/settings/RolesPermissionsMatrix';

export default function RolesPermissionsPage() {
  const t = useTranslations('admin.rolesPermissions');
  const { profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (profile?.role !== 'super_admin') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-navy">{t('title')}</h1>
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={ShieldAlert}
            title={t('forbidden.title')}
            description={t('forbidden.description')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>
      <RolesPermissionsMatrix />
    </div>
  );
}

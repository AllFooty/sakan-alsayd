'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import EmptyState from '@/components/admin/shared/EmptyState';
import BuildingForm from '@/components/admin/buildings/BuildingForm';
import { Building2 } from 'lucide-react';

export default function NewBuildingPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('admin.buildings.form');
  const canCreate =
    !!profile &&
    (profile.role === 'super_admin' || profile.role === 'deputy_general_manager');

  useEffect(() => {
    if (!loading && profile && !canCreate) {
      router.replace(`/${locale}/admin/buildings`);
    }
  }, [loading, profile, canCreate, router, locale]);

  if (loading) return <LoadingScreen />;
  if (!canCreate) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState
          icon={Building2}
          title={t('forbidden.title')}
          description={t('forbidden.description')}
        />
      </div>
    );
  }

  return <BuildingForm mode="create" canToggleStatus={true} />;
}

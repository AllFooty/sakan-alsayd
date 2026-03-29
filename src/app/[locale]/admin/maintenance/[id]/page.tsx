'use client';

import { use } from 'react';
import { useAuth } from '@/lib/auth/hooks';
import MaintenanceDetail from '@/components/admin/maintenance/MaintenanceDetail';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';

export default function MaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return <MaintenanceDetail requestId={id} />;
}

'use client';

import { use } from 'react';
import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import BuildingDetail from '@/components/admin/buildings/BuildingDetail';

export default function BuildingDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return <BuildingDetail buildingId={id} />;
}

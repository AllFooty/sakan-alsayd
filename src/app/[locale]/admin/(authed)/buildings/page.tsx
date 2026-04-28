'use client';

import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import BuildingsList from '@/components/admin/buildings/BuildingsList';

export default function BuildingsPage() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return <BuildingsList />;
}

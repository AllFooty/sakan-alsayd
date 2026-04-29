'use client';

import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import ResidentsList from '@/components/admin/residents/ResidentsList';

export default function ResidentsPage() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return <ResidentsList />;
}

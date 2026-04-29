'use client';

import { use } from 'react';
import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import ResidentDetail from '@/components/admin/residents/ResidentDetail';

export default function ResidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { loading } = useAuth();
  const { id } = use(params);

  if (loading) {
    return <LoadingScreen />;
  }

  return <ResidentDetail id={id} />;
}

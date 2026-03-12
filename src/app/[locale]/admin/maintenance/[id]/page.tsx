'use client';

import { use } from 'react';
import { useAuth } from '@/lib/auth/hooks';
import MaintenanceDetail from '@/components/admin/maintenance/MaintenanceDetail';

export default function MaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
            <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
          </div>
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return <MaintenanceDetail requestId={id} />;
}

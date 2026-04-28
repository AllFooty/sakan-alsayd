'use client';

import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import OccupancyDashboard from '@/components/admin/occupancy/OccupancyDashboard';

export default function OccupancyPage() {
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return <OccupancyDashboard />;
}

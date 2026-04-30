'use client';

import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import {
  MessageSquare,
  Wrench,
  Building2,
  Users,
} from 'lucide-react';

export interface DashboardStats {
  newBookings: number;
  openMaintenance: number;
  totalBuildings: number;
  activeResidents: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon size={24} className="text-white" />
        </div>
        <div>
          {loading ? (
            <div className="h-7 w-12 bg-gray-200 dark:bg-[var(--admin-surface-2)] rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-navy dark:text-[var(--admin-text)]">{value}</p>
          )}
          <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">{label}</p>
        </div>
      </div>
    </div>
  );
}

const statsFetcher = async (url: string): Promise<DashboardStats> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`stats fetch failed: ${res.status}`);
  return res.json();
};

export default function DashboardStatsClient({
  initialStats,
}: {
  initialStats: DashboardStats;
}) {
  const t = useTranslations('admin.dashboard');

  const { data: stats, error, isLoading } = useSWR<DashboardStats>(
    '/api/admin/dashboard-stats',
    statsFetcher,
    {
      fallbackData: initialStats,
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    },
  );

  const errorToastShown = useRef(false);
  useEffect(() => {
    if (error && !errorToastShown.current) {
      toast.error(t('statsError'));
      errorToastShown.current = true;
    } else if (!error) {
      errorToastShown.current = false;
    }
  }, [error, t]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={MessageSquare}
        label={t('stats.newBookings')}
        value={stats?.newBookings ?? 0}
        color="bg-coral"
        loading={isLoading}
      />
      <StatCard
        icon={Wrench}
        label={t('stats.openMaintenance')}
        value={stats?.openMaintenance ?? 0}
        color="bg-orange-500"
        loading={isLoading}
      />
      <StatCard
        icon={Building2}
        label={t('stats.totalBuildings')}
        value={stats?.totalBuildings ?? 0}
        color="bg-navy"
        loading={isLoading}
      />
      <StatCard
        icon={Users}
        label={t('stats.activeResidents')}
        value={stats?.activeResidents ?? 0}
        color="bg-green-600"
        loading={isLoading}
      />
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/hooks';
import { useEffect, useRef } from 'react';
import {
  MessageSquare,
  Wrench,
  Building2,
  Users,
} from 'lucide-react';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';

interface DashboardStats {
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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon size={24} className="text-white" />
        </div>
        <div>
          {loading ? (
            <div className="h-7 w-12 bg-gray-200 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-navy">{value}</p>
          )}
          <p className="text-sm text-gray-500">{label}</p>
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

export default function AdminDashboard() {
  const t = useTranslations('admin.dashboard');
  const { profile, loading: authLoading } = useAuth();

  const { data: stats, error, isLoading } = useSWR<DashboardStats>(
    '/api/admin/dashboard-stats',
    statsFetcher,
    { refreshInterval: 30_000, revalidateOnFocus: true, dedupingInterval: 10_000 },
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

  if (authLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">
          {t('welcome', { name: profile?.full_name || '' })}
        </h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

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

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-navy mb-4">
          {t('recentActivity')}
        </h2>
        <p className="text-gray-400 text-sm">{t('noActivity')}</p>
      </div>
    </div>
  );
}

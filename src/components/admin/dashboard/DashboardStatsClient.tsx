'use client';

import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Wrench,
  Building2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DashboardStats {
  newBookings: number;
  openMaintenance: number;
  totalBuildings: number;
  activeResidents: number;
}

type Range = '7' | '30' | '90';
const RANGE_VALUES: Range[] = ['7', '30', '90'];
const RANGE_STORAGE_KEY = 'admin.dashboard.range';

function StatCard({
  icon: Icon,
  label,
  value,
  subline,
  color,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  subline: string;
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
          <p className="text-xs text-gray-400 dark:text-[var(--admin-text-subtle)] mt-0.5">{subline}</p>
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
  // Initial render must match SSR (no localStorage), so default to '30'
  // and hydrate the user's saved choice on the client after mount.
  const [range, setRange] = useState<Range>('30');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RANGE_STORAGE_KEY);
      if (saved && RANGE_VALUES.includes(saved as Range)) {
        // Hydrate user's saved range after mount. SSR can't see localStorage,
        // so this synchronous setState in effect is the documented pattern
        // for client-only persistence. Re-render is intentional.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRange(saved as Range);
      }
    } catch {
      // localStorage access can throw in private mode — fall through.
    }
  }, []);

  function handleRangeChange(next: Range) {
    setRange(next);
    try {
      window.localStorage.setItem(RANGE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  const { data: stats, error, isLoading } = useSWR<DashboardStats>(
    `/api/admin/dashboard-stats?range=${range}`,
    statsFetcher,
    {
      fallbackData: range === '30' ? initialStats : undefined,
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

  const flowSubline = t('stats.inLastDays', { days: range });
  const snapshotSubline = t('stats.snapshotNow');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">
          {t('stats.rangeLabel')}
        </p>
        <div
          role="group"
          aria-label={t('stats.rangeLabel')}
          className="inline-flex rounded-lg border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] overflow-hidden"
        >
          {RANGE_VALUES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRangeChange(r)}
              aria-pressed={range === r}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-coral/50',
                range === r
                  ? 'bg-coral text-white'
                  : 'text-gray-600 dark:text-[var(--admin-text-muted)] hover:bg-gray-50 dark:hover:bg-[var(--admin-surface-2)]'
              )}
            >
              {t('stats.rangeOption', { days: r })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={MessageSquare}
          label={t('stats.newBookings')}
          value={stats?.newBookings ?? 0}
          subline={flowSubline}
          color="bg-coral"
          loading={isLoading}
        />
        <StatCard
          icon={Wrench}
          label={t('stats.openMaintenance')}
          value={stats?.openMaintenance ?? 0}
          subline={flowSubline}
          color="bg-orange-500"
          loading={isLoading}
        />
        <StatCard
          icon={Building2}
          label={t('stats.totalBuildings')}
          value={stats?.totalBuildings ?? 0}
          subline={snapshotSubline}
          color="bg-navy"
          loading={isLoading}
        />
        <StatCard
          icon={Users}
          label={t('stats.activeResidents')}
          value={stats?.activeResidents ?? 0}
          subline={snapshotSubline}
          color="bg-green-600"
          loading={isLoading}
        />
      </div>
    </div>
  );
}

import { getTranslations } from 'next-intl/server';
import { getAuthenticatedStaff } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import DashboardStatsClient, {
  type DashboardStats,
} from '@/components/admin/dashboard/DashboardStatsClient';
import RecentActivityList from '@/components/admin/dashboard/RecentActivityList';

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [{ profile }, t] = await Promise.all([
    getAuthenticatedStaff(locale),
    getTranslations('admin.dashboard'),
  ]);

  const supabase = await createClient();
  const { data } = await supabase.rpc('dashboard_counters');
  const row = Array.isArray(data) ? data[0] : data;

  const initialStats: DashboardStats = {
    newBookings: Number(row?.new_bookings ?? 0),
    openMaintenance: Number(row?.open_maintenance ?? 0),
    totalBuildings: Number(row?.total_buildings ?? 0),
    activeResidents: Number(row?.active_residents ?? 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy dark:text-[var(--admin-text)]">
          {t('welcome', { name: profile?.full_name || '' })}
        </h1>
        <p className="text-gray-500 dark:text-[var(--admin-text-muted)] mt-1">{t('subtitle')}</p>
      </div>

      <DashboardStatsClient initialStats={initialStats} />

      <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-6">
        <h2 className="text-lg font-semibold text-navy dark:text-[var(--admin-text)] mb-4">
          {t('recentActivity')}
        </h2>
        <RecentActivityList />
      </div>
    </div>
  );
}

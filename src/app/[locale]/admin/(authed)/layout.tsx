import { getAuthenticatedStaff } from '@/lib/auth/guards';
import AdminShell from '@/components/admin/layout/AdminShell';
import { getPublicBuildings, getPublicCities } from '@/lib/buildings/public';
import { PublicBuildingsProvider } from '@/components/providers/PublicBuildingsProvider';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Auth gate first; only fetch the buildings list once we know we're
  // serving an authenticated admin (avoids a wasted Supabase round-trip on
  // the redirect-to-login path).
  const { user, profile } = await getAuthenticatedStaff(locale);

  const [buildings, cities] = await Promise.all([
    getPublicBuildings(),
    getPublicCities(),
  ]);

  return (
    <PublicBuildingsProvider buildings={buildings} cities={cities}>
      <AdminShell initialUser={user} initialProfile={profile}>
        {children}
      </AdminShell>
    </PublicBuildingsProvider>
  );
}

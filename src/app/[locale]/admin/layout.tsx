import { getAuthenticatedStaff } from '@/lib/auth/guards';
import AdminShell from '@/components/admin/layout/AdminShell';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { user, profile } = await getAuthenticatedStaff(locale);

  return (
    <AdminShell initialUser={user} initialProfile={profile}>
      {children}
    </AdminShell>
  );
}

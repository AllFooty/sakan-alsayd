'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { UserX } from 'lucide-react';
import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import EmptyState from '@/components/admin/shared/EmptyState';
import ResidentForm from '@/components/admin/residents/ResidentForm';
import type { ResidentRow } from '@/lib/residents/types';

const CAN_EDIT_ROLES = [
  'super_admin',
  'deputy_general_manager',
  'branch_manager',
  'supervision_staff',
] as const;

export default function EditResidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('admin.residents');

  const canEdit =
    !!profile && (CAN_EDIT_ROLES as readonly string[]).includes(profile.role);

  const [resident, setResident] = useState<ResidentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!authLoading && profile && !canEdit) {
      router.replace(`/${locale}/admin/residents`);
    }
  }, [authLoading, profile, canEdit, router, locale]);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/residents/${id}`);
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Failed');
        const json = (await res.json()) as { data: ResidentRow };
        setResident(json.data);
      } catch (err) {
        console.error('Failed to load resident:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, canEdit]);

  if (authLoading || loading || !canEdit) return <LoadingScreen />;

  if (notFound || !resident) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState icon={UserX} title={t('toast.notFound')} description="" />
      </div>
    );
  }

  return <ResidentForm mode="edit" resident={resident} />;
}

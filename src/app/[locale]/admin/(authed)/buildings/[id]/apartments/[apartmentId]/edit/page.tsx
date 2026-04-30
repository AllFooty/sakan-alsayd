'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Home as HomeIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import EmptyState from '@/components/admin/shared/EmptyState';
import ApartmentForm, {
  type ApartmentFormValues,
} from '@/components/admin/buildings/ApartmentForm';

interface ApartmentApi {
  id: string;
  building_id: string;
  apartment_number: string;
  floor: number;
  description_en: string;
  description_ar: string;
  notes: string | null;
  has_kitchen: boolean;
  has_living_room: boolean;
  shared_bathroom_count: number;
  private_bathroom_count: number;
  is_active: boolean;
  sort_order: number;
  building: {
    id: string;
    city_en: string;
    city_ar: string;
    neighborhood_en: string;
    neighborhood_ar: string;
  } | null;
}

export default function EditApartmentPage({
  params,
}: {
  params: Promise<{ id: string; apartmentId: string; locale: string }>;
}) {
  const { id: buildingId, apartmentId } = use(params);
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const t = useTranslations('admin.buildings.apartmentForm');

  const canEdit =
    !!profile &&
    (profile.role === 'super_admin' ||
      profile.role === 'deputy_general_manager' ||
      profile.role === 'branch_manager');
  const canDelete =
    !!profile &&
    (profile.role === 'super_admin' || profile.role === 'deputy_general_manager');
  // is_active toggle is admin-tier only — mirrors the API gate.
  const canToggleActive = canDelete;

  const [initial, setInitial] = useState<Partial<ApartmentFormValues> | null>(null);
  const [buildingLabel, setBuildingLabel] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!authLoading && profile && !canEdit) {
      router.replace(`/${locale}/admin/buildings/${buildingId}`);
    }
  }, [authLoading, profile, canEdit, router, locale, buildingId]);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/apartments/${apartmentId}`);
        if (cancelled) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        const a = json.data as ApartmentApi;
        if (a.building_id !== buildingId) {
          setNotFound(true);
          return;
        }
        setInitial({
          apartment_number: a.apartment_number,
          floor: String(a.floor),
          description_en: a.description_en,
          description_ar: a.description_ar,
          has_kitchen: a.has_kitchen,
          has_living_room: a.has_living_room,
          shared_bathroom_count: String(a.shared_bathroom_count),
          private_bathroom_count: String(a.private_bathroom_count),
          sort_order: String(a.sort_order),
          is_active: a.is_active,
          notes: a.notes ?? '',
        });
        if (a.building) {
          setBuildingLabel(
            isArabic
              ? `${a.building.neighborhood_ar} — ${a.building.city_ar}`
              : `${a.building.neighborhood_en} — ${a.building.city_en}`
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load apartment:', err);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [apartmentId, buildingId, canEdit, isArabic]);

  if (authLoading || loading) return <LoadingScreen />;

  if (!canEdit) {
    return (
      <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)]">
        <EmptyState
          icon={HomeIcon}
          title={t('forbidden.title')}
          description={t('forbidden.description')}
        />
      </div>
    );
  }

  if (notFound || !initial) {
    return (
      <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)]">
        <EmptyState
          icon={HomeIcon}
          title={t('notFound.title')}
          description={t('notFound.description')}
        />
      </div>
    );
  }

  return (
    <ApartmentForm
      mode="edit"
      buildingId={buildingId}
      apartmentId={apartmentId}
      buildingLabel={buildingLabel}
      initial={initial}
      canDelete={canDelete}
      canToggleActive={canToggleActive}
    />
  );
}

'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { DoorOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import EmptyState from '@/components/admin/shared/EmptyState';
import RoomForm from '@/components/admin/buildings/RoomForm';

interface BuildingLite {
  id: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
}

export default function NewRoomPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id: buildingId } = use(params);
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const t = useTranslations('admin.buildings.roomForm');

  // Create is admin-tier only (mirrors POST /api/admin/buildings).
  const canCreate =
    !!profile &&
    (profile.role === 'super_admin' || profile.role === 'deputy_general_manager');

  const [building, setBuilding] = useState<BuildingLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!authLoading && profile && !canCreate) {
      router.replace(`/${locale}/admin/buildings/${buildingId}`);
    }
  }, [authLoading, profile, canCreate, router, locale, buildingId]);

  useEffect(() => {
    if (!canCreate) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/buildings/${buildingId}`);
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        const b = json.data as BuildingLite;
        setBuilding({
          id: b.id,
          city_en: b.city_en,
          city_ar: b.city_ar,
          neighborhood_en: b.neighborhood_en,
          neighborhood_ar: b.neighborhood_ar,
        });
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load building:', err);
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
  }, [buildingId, canCreate]);

  if (authLoading || loading) return <LoadingScreen />;

  if (!canCreate) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState
          icon={DoorOpen}
          title={t('forbidden.title')}
          description={t('forbidden.description')}
        />
      </div>
    );
  }

  if (notFound || !building) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState
          icon={DoorOpen}
          title={t('notFound.title')}
          description={t('notFound.description')}
        />
      </div>
    );
  }

  const buildingLabel = isArabic
    ? `${building.neighborhood_ar} — ${building.city_ar}`
    : `${building.neighborhood_en} — ${building.city_en}`;

  return (
    <RoomForm
      mode="create"
      buildingId={buildingId}
      buildingLabel={buildingLabel}
    />
  );
}

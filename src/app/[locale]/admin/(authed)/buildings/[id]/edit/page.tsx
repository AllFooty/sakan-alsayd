'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, PowerOff, Loader2, Power } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import EmptyState from '@/components/admin/shared/EmptyState';
import BuildingForm, {
  type BuildingFormValues,
  type LandmarkInput,
} from '@/components/admin/buildings/BuildingForm';

interface BuildingApi {
  slug: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
  description_en: string;
  description_ar: string;
  map_url: string | null;
  landmarks: unknown;
  is_active: boolean;
  is_placeholder: boolean;
  sort_order: number;
}

function parseLandmarks(raw: unknown): LandmarkInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({
      name_en: typeof e.name_en === 'string' ? e.name_en : '',
      name_ar: typeof e.name_ar === 'string' ? e.name_ar : '',
      distance_en: typeof e.distance_en === 'string' ? e.distance_en : '',
      distance_ar: typeof e.distance_ar === 'string' ? e.distance_ar : '',
    }));
}

export default function EditBuildingPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('admin.buildings.form');

  const canEdit =
    !!profile &&
    (profile.role === 'super_admin' ||
      profile.role === 'deputy_general_manager' ||
      profile.role === 'branch_manager');

  const canToggleStatus =
    !!profile &&
    (profile.role === 'super_admin' ||
      profile.role === 'deputy_general_manager');

  const [initial, setInitial] = useState<Partial<BuildingFormValues> | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  async function handleReactivate() {
    setReactivating(true);
    try {
      const res = await fetch(`/api/admin/buildings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(t('toast.reactivated'));
      setInitial((prev) => (prev ? { ...prev, is_active: true } : prev));
    } catch (err) {
      console.error('Reactivate failed:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setReactivating(false);
    }
  }

  useEffect(() => {
    if (!authLoading && profile && !canEdit) {
      router.replace(`/${locale}/admin/buildings`);
    }
  }, [authLoading, profile, canEdit, router, locale]);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/buildings/${id}`);
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        const b: BuildingApi = json.data;
        setInitial({
          slug: b.slug,
          city_en: b.city_en,
          city_ar: b.city_ar,
          neighborhood_en: b.neighborhood_en,
          neighborhood_ar: b.neighborhood_ar,
          description_en: b.description_en ?? '',
          description_ar: b.description_ar ?? '',
          map_url: b.map_url ?? '',
          landmarks: parseLandmarks(b.landmarks),
          is_active: b.is_active,
          is_placeholder: b.is_placeholder,
          sort_order: b.sort_order,
        });
      } catch (err) {
        console.error('Failed to load building:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, canEdit]);

  if (authLoading || loading) return <LoadingScreen />;

  if (!canEdit) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState
          icon={Building2}
          title={t('forbidden.title')}
          description={t('forbidden.description')}
        />
      </div>
    );
  }

  if (notFound || !initial) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState
          icon={Building2}
          title={t('notFound.title')}
          description={t('notFound.description')}
        />
      </div>
    );
  }

  const isInactive = initial.is_active === false;

  return (
    <div className="space-y-4">
      {isInactive && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <PowerOff size={18} className="mt-0.5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {t('inactiveBanner.title')}
              </p>
              <p className="text-sm text-amber-800 mt-0.5">
                {canToggleStatus
                  ? t('inactiveBanner.descriptionAdmin')
                  : t('inactiveBanner.descriptionScoped')}
              </p>
            </div>
          </div>
          {canToggleStatus && (
            <button
              type="button"
              onClick={handleReactivate}
              disabled={reactivating}
              className="self-start inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-300 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors"
            >
              {reactivating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Power size={14} />
              )}
              {t('inactiveBanner.reactivate')}
            </button>
          )}
        </div>
      )}
      <BuildingForm
        mode="edit"
        buildingId={id}
        initial={initial}
        canToggleStatus={canToggleStatus}
        readOnly={isInactive}
      />
    </div>
  );
}

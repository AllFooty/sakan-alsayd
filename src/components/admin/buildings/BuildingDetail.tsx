'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  MapPin,
  ImageOff,
  ImageIcon,
  Wrench,
  Users as UsersIcon,
  DoorOpen,
  CheckCircle2,
  Hash,
  Calendar,
  ExternalLink,
  Pencil,
  Power,
  PowerOff,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '@/components/admin/shared/StatusBadge';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';
import BuildingPhotosManager from './BuildingPhotosManager';
import BuildingRoomsTab from './BuildingRoomsTab';
import { useAuth } from '@/lib/auth/hooks';
import { formatDate } from '@/lib/utils';

interface RoomStats {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
  reserved: number;
}

interface Landmark {
  name_en?: string;
  name_ar?: string;
  distance_en?: string;
  distance_ar?: string;
}

interface Building {
  id: string;
  slug: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
  description_en: string;
  description_ar: string;
  cover_image: string | null;
  images: string[] | null;
  map_url: string | null;
  landmarks: unknown;
  is_active: boolean;
  is_placeholder: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  room_stats: RoomStats;
  active_maintenance_count: number;
  active_residents_count: number;
}

function isLandmarkArray(val: unknown): val is Landmark[] {
  return Array.isArray(val);
}

export default function BuildingDetail({ buildingId }: { buildingId: string }) {
  const t = useTranslations('admin.buildings');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();
  const { profile } = useAuth();
  const canEdit =
    !!profile &&
    (profile.role === 'super_admin' || profile.role === 'deputy_general_manager');
  // Photos: admin tier OR branch_manager assigned to this building. The API
  // enforces the assignment check; if they're viewing the detail page at all,
  // they have access (the GET 404s otherwise).
  const canManagePhotos =
    !!profile &&
    (profile.role === 'super_admin' ||
      profile.role === 'deputy_general_manager' ||
      profile.role === 'branch_manager');

  const [building, setBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'rooms'>('overview');

  useEffect(() => {
    let cancelled = false;
    async function fetchBuilding() {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/admin/buildings/${buildingId}`);
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        setBuilding(json.data);
        setActiveImage(json.data?.cover_image ?? json.data?.images?.[0] ?? null);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch building:', err);
        toast.error(t('toast.genericError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchBuilding();
    return () => {
      cancelled = true;
    };
  }, [buildingId, t]);

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  async function handleDeactivate() {
    if (!building) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/buildings/${building.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(t('detail.toast.deactivated'));
      setShowDeactivateConfirm(false);
      setBuilding({ ...building, is_active: false });
    } catch (err) {
      console.error('Deactivate failed:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate() {
    if (!building) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/buildings/${building.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(t('detail.toast.reactivated'));
      setBuilding({ ...building, is_active: true });
    } catch (err) {
      console.error('Reactivate failed:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <DetailSkeleton />;

  if (notFound || !building) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Building2 size={40} className="mx-auto text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-navy">
          {t('detail.notFound.title')}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('detail.notFound.description')}
        </p>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/buildings`)}
          className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy/90 transition-colors"
        >
          <BackIcon size={16} />
          {t('detail.backToList')}
        </button>
      </div>
    );
  }

  const name = isArabic ? building.neighborhood_ar : building.neighborhood_en;
  const city = isArabic ? building.city_ar : building.city_en;
  const description = isArabic ? building.description_ar : building.description_en;
  const landmarks = isLandmarkArray(building.landmarks) ? building.landmarks : [];
  const galleryImages = building.images ?? [];
  const occupancyPct =
    building.room_stats.total > 0
      ? Math.round((building.room_stats.occupied / building.room_stats.total) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/buildings`)}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-navy transition-colors w-fit"
        >
          <BackIcon size={16} />
          {t('detail.backToList')}
        </button>
        {canEdit && (
          <div className="flex items-center gap-2">
            {building.is_active ? (
              <button
                type="button"
                onClick={() => setShowDeactivateConfirm(true)}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:border-red-200 hover:text-red-600 disabled:opacity-50 transition-colors"
              >
                <PowerOff size={14} />
                {t('detail.deactivate')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReactivate}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-emerald-700 text-sm font-medium rounded-lg hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                {t('detail.reactivate')}
              </button>
            )}
            <Link
              href={`/${locale}/admin/buildings/${building.id}/edit`}
              className="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
            >
              <Pencil size={14} />
              {t('detail.editButton')}
            </Link>
          </div>
        )}
      </div>

      {/* Hero — cover image + overlaid name/city */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="relative aspect-[16/7] bg-gray-100">
          {activeImage ? (
            <Image
              src={activeImage}
              alt={name}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
              <ImageOff size={40} />
              <span className="text-sm mt-2">{t('card.noPhoto')}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute start-4 bottom-4 end-4 text-white">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusBadge
                label={building.is_active ? t('status.active') : t('status.inactive')}
                variant={building.is_active ? 'success' : 'neutral'}
              />
              {building.is_placeholder && (
                <StatusBadge label={t('status.placeholder')} variant="warning" />
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold drop-shadow">{name}</h1>
            <p className="text-sm sm:text-base text-white/90 flex items-center gap-1.5 mt-1">
              <MapPin size={14} />
              {city}
            </p>
          </div>
        </div>

        {/* Photo strip */}
        {(building.cover_image || galleryImages.length > 0) && (
          <div className="border-t border-gray-100 bg-gray-50 p-3 flex gap-2 overflow-x-auto">
            {building.cover_image && (
              <PhotoThumb
                src={building.cover_image}
                active={activeImage === building.cover_image}
                onClick={() => setActiveImage(building.cover_image)}
                badgeLabel={t('detail.coverPhoto')}
              />
            )}
            {galleryImages
              .filter((src) => src !== building.cover_image)
              .map((src) => (
                <PhotoThumb
                  key={src}
                  src={src}
                  active={activeImage === src}
                  onClick={() => setActiveImage(src)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={DoorOpen}
          label={t('detail.stats.totalRooms')}
          value={building.room_stats.total}
          tone="navy"
        />
        <StatCard
          icon={CheckCircle2}
          label={t('detail.stats.available')}
          value={building.room_stats.available}
          tone="emerald"
        />
        <StatCard
          icon={UsersIcon}
          label={t('detail.stats.occupied')}
          value={building.room_stats.occupied}
          subValue={
            building.room_stats.total > 0
              ? t('detail.stats.occupancyPct', { pct: occupancyPct })
              : undefined
          }
          tone="coral"
        />
        <StatCard
          icon={Wrench}
          label={t('detail.stats.activeMaintenance')}
          value={building.active_maintenance_count}
          tone="amber"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-2" role="tablist" aria-label={t('detail.tabsLabel')}>
          <TabButton
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          >
            {t('detail.tabs.overview')}
          </TabButton>
          <TabButton
            active={activeTab === 'rooms'}
            onClick={() => setActiveTab('rooms')}
            count={building.room_stats.total}
          >
            {t('detail.tabs.rooms')}
          </TabButton>
        </nav>
      </div>

      {activeTab === 'rooms' ? (
        <BuildingRoomsTab buildingId={building.id} />
      ) : (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <Section title={t('detail.about')}>
            {description ? (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {description}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">
                {t('detail.noDescription')}
              </p>
            )}
          </Section>

          {/* Landmarks */}
          <Section title={t('detail.landmarks')} icon={MapPin}>
            {landmarks.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                {t('detail.noLandmarks')}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {landmarks.map((lm, i) => {
                  const lmName = isArabic ? lm.name_ar : lm.name_en;
                  const lmDistance = isArabic ? lm.distance_ar : lm.distance_en;
                  if (!lmName) return null;
                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between py-2.5 text-sm"
                    >
                      <span className="text-gray-700">{lmName}</span>
                      {lmDistance && (
                        <span className="text-gray-500 text-xs">{lmDistance}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Photo gallery — read-only for staff without edit rights; full manager for admin tier and branch managers */}
          {canManagePhotos ? (
            <BuildingPhotosManager
              buildingId={building.id}
              coverImage={building.cover_image}
              images={galleryImages}
              disabled={!building.is_active}
              onChange={(nextCover, nextImages) => {
                setBuilding((prev) =>
                  prev
                    ? { ...prev, cover_image: nextCover, images: nextImages }
                    : prev
                );
                setActiveImage(nextCover ?? nextImages[0] ?? null);
              }}
            />
          ) : (
            <Section title={t('detail.photoGallery')} icon={ImageIcon}>
              {galleryImages.length === 0 && !building.cover_image ? (
                <p className="text-sm text-gray-400 italic">
                  {t('detail.noPhotos')}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(building.cover_image ? [building.cover_image] : [])
                    .concat(galleryImages.filter((s) => s !== building.cover_image))
                    .map((src, i) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setActiveImage(src)}
                        className={`relative aspect-square overflow-hidden rounded-lg border ${
                          activeImage === src ? 'border-coral' : 'border-gray-200'
                        } hover:border-coral/50 transition-colors`}
                      >
                        <Image
                          src={src}
                          alt={`${name} ${i + 1}`}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                </div>
              )}
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Map */}
          <Section title={t('detail.location')} icon={MapPin}>
            {building.map_url ? (
              <a
                href={building.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-sm text-coral hover:text-coral/80 font-medium"
              >
                <span>{t('detail.openInMaps')}</span>
                <ExternalLink size={14} />
              </a>
            ) : (
              <p className="text-sm text-gray-400 italic">
                {t('detail.noMap')}
              </p>
            )}
          </Section>

          {/* Residents quick link */}
          <Section title={t('detail.residents')} icon={UsersIcon}>
            <div className="text-2xl font-bold text-navy tabular-nums">
              {building.active_residents_count}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('detail.activeAssignmentsHint')}
            </p>
          </Section>

          {/* Metadata */}
          <Section title={t('detail.metadata')}>
            <dl className="space-y-3 text-sm">
              <MetaRow icon={Hash} label={t('detail.meta.slug')}>
                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                  {building.slug}
                </code>
              </MetaRow>
              <MetaRow icon={Hash} label={t('detail.meta.sortOrder')}>
                <span className="text-gray-700 tabular-nums">
                  {building.sort_order}
                </span>
              </MetaRow>
              <MetaRow icon={Calendar} label={t('detail.meta.createdAt')}>
                <span className="text-gray-700">
                  {formatDate(building.created_at, isArabic ? 'ar' : 'en')}
                </span>
              </MetaRow>
              <MetaRow icon={Calendar} label={t('detail.meta.updatedAt')}>
                <span className="text-gray-700">
                  {formatDate(building.updated_at, isArabic ? 'ar' : 'en')}
                </span>
              </MetaRow>
            </dl>
          </Section>
        </div>
      </div>

      {/* Bilingual names — useful for super admins curating content */}
      {canEdit && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-navy mb-3">
            {t('detail.bilingualNames')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {t('detail.bilingual.english')}
              </p>
              <p className="mt-1 text-gray-700" dir="ltr">
                {building.neighborhood_en}, {building.city_en}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {t('detail.bilingual.arabic')}
              </p>
              <p className="mt-1 text-gray-700" dir="rtl">
                {building.neighborhood_ar}، {building.city_ar}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Crumb back at the bottom too — helps on long pages */}
      <div className="pt-2">
        <Link
          href={`/${locale}/admin/buildings`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy transition-colors"
        >
          <BackIcon size={14} />
          {t('detail.backToList')}
        </Link>
      </div>
      </>
      )}

      <ConfirmDialog
        isOpen={showDeactivateConfirm}
        onClose={() => setShowDeactivateConfirm(false)}
        onConfirm={handleDeactivate}
        title={t('detail.deactivateConfirm.title')}
        description={t('detail.deactivateConfirm.description', { name })}
        confirmLabel={t('detail.deactivate')}
        cancelLabel={t('detail.deactivateConfirm.cancel')}
        variant="warning"
        loading={actionLoading}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 ${
        active
          ? 'text-coral'
          : 'text-gray-500 hover:text-navy'
      }`}
    >
      {children}
      {typeof count === 'number' && (
        <span
          className={`text-xs tabular-nums px-1.5 py-0.5 rounded-full ${
            active ? 'bg-coral/10 text-coral' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {count}
        </span>
      )}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 bg-coral rounded-full" />
      )}
    </button>
  );
}

function PhotoThumb({
  src,
  active,
  onClick,
  badgeLabel,
}: {
  src: string;
  active: boolean;
  onClick: () => void;
  badgeLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-16 w-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
        active ? 'border-coral' : 'border-transparent hover:border-gray-300'
      }`}
    >
      <Image src={src} alt="" fill sizes="96px" className="object-cover" />
      {badgeLabel && (
        <span className="absolute top-0.5 start-0.5 text-[10px] font-medium bg-coral text-white px-1.5 py-0.5 rounded">
          {badgeLabel}
        </span>
      )}
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  tone,
}: {
  icon: typeof DoorOpen;
  label: string;
  value: number;
  subValue?: string;
  tone: 'navy' | 'emerald' | 'coral' | 'amber';
}) {
  const tones: Record<typeof tone, string> = {
    navy: 'bg-navy/5 text-navy',
    emerald: 'bg-emerald-50 text-emerald-600',
    coral: 'bg-coral/10 text-coral',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${tones[tone]}`}>
          <Icon size={16} />
        </div>
        <p className="text-xs text-gray-500 uppercase tracking-wide truncate">
          {label}
        </p>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-navy tabular-nums">
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-gray-500 tabular-nums">{subValue}</span>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof DoorOpen;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-navy mb-3">
        {Icon && <Icon size={16} className="text-gray-400" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof DoorOpen;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-gray-500 text-xs uppercase tracking-wide flex-shrink-0">
        <Icon size={12} />
        {label}
      </dt>
      <dd className="text-end">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="aspect-[16/7] bg-gray-100 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
          >
            <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
            <div className="h-7 bg-gray-100 rounded animate-pulse w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-5 space-y-3"
            >
              <div className="h-4 bg-gray-100 rounded animate-pulse w-32" />
              <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
              <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-5 space-y-3"
            >
              <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
              <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

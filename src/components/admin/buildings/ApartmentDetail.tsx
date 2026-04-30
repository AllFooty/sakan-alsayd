'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  Home as HomeIcon,
  DoorOpen,
  Users,
  StickyNote,
  ExternalLink,
  Pencil,
  Trash2,
  Plus,
  ChefHat,
  Sofa,
  Bath,
  FileText,
  ChevronRight,
  ChevronLeft,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge, {
  getRoomStatusVariant,
} from '@/components/admin/shared/StatusBadge';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';
import DefaultApartmentTag from './DefaultApartmentTag';
import { cn, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth/hooks';
import { isAutoApartmentNumber } from '@/lib/apartments/auto-name';

interface ApartmentRoom {
  id: string;
  room_number: string | null;
  floor: number | null;
  room_type: string;
  bathroom_type: string;
  capacity: number;
  occupancy_mode: 'private' | 'shared';
  monthly_price: number;
  discounted_price: number | null;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

interface ApartmentAssignment {
  id: string;
  room_id: string;
  resident_id: string;
  check_in_date: string;
  status: 'active' | 'ended';
  resident: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    nationality: string | null;
    profile_image: string | null;
    status: string;
  } | null;
}

interface BuildingSummary {
  id: string;
  slug: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
}

interface ApartmentDetailData {
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
  created_at: string;
  updated_at: string;
  building: BuildingSummary | null;
  rooms: ApartmentRoom[];
  active_assignments: ApartmentAssignment[];
  stats: {
    rooms_count: number;
    total_capacity: number;
    active_residents_count: number;
  };
}

interface ApartmentDetailProps {
  buildingId: string;
  apartmentId: string;
}

export default function ApartmentDetail({
  buildingId,
  apartmentId,
}: ApartmentDetailProps) {
  const t = useTranslations('admin.buildings.apartmentDetail');
  const tForm = useTranslations('admin.buildings.apartmentForm');
  const tStatus = useTranslations('admin.buildings.roomStatus');
  const tType = useTranslations('rooms.types');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();
  const { profile } = useAuth();

  const canEdit =
    !!profile &&
    (profile.role === 'super_admin' ||
      profile.role === 'deputy_general_manager' ||
      profile.role === 'branch_manager');
  const canDelete =
    !!profile &&
    (profile.role === 'super_admin' || profile.role === 'deputy_general_manager');
  const canAddRoom = canDelete;

  const [apartment, setApartment] = useState<ApartmentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  const ForwardChevron = isArabic ? ChevronLeft : ChevronRight;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/admin/apartments/${apartmentId}`);
        if (cancelled) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        const data = json.data as ApartmentDetailData;
        // Guard against URL tampering — the apartment must belong to the
        // building in the URL. Otherwise treat as not found.
        if (data.building_id !== buildingId) {
          setNotFound(true);
          return;
        }
        setApartment(data);
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
  }, [apartmentId, buildingId]);

  const handleDelete = useCallback(async () => {
    if (!apartment) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/apartments/${apartment.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const code = json?.error;
        if (code === 'apartmentHasRooms') {
          toast.error(tForm('errors.apartmentHasRooms'));
        } else {
          toast.error(tForm('toast.genericError'));
        }
        setShowDeleteConfirm(false);
        return;
      }
      toast.success(tForm('toast.deleted'));
      router.push(`/${locale}/admin/buildings/${buildingId}#layout`);
    } catch (err) {
      console.error('Apartment delete failed:', err);
      toast.error(tForm('toast.genericError'));
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }, [apartment, router, locale, buildingId, tForm]);

  if (loading) return <DetailSkeleton />;

  if (notFound || !apartment) {
    return (
      <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-12 text-center">
        <HomeIcon size={40} className="mx-auto text-gray-300 dark:text-[var(--admin-text-subtle)]" />
        <h2 className="mt-4 text-lg font-semibold text-navy dark:text-[var(--admin-text)]">
          {t('notFoundTitle')}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">
          {t('notFoundDescription')}
        </p>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/buildings/${buildingId}#layout`)}
          className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy/90 transition-colors"
        >
          <BackIcon size={16} />
          {t('backToBuilding')}
        </button>
      </div>
    );
  }

  const isDefault = isAutoApartmentNumber(apartment.apartment_number);
  const description = isArabic ? apartment.description_ar : apartment.description_en;
  const buildingLabel = apartment.building
    ? isArabic
      ? `${apartment.building.neighborhood_ar} — ${apartment.building.city_ar}`
      : `${apartment.building.neighborhood_en} — ${apartment.building.city_en}`
    : null;

  // Index assignments by room_id so room cards can flag "occupied" with
  // the resident's name without an extra query.
  const assignmentsByRoom = new Map<string, ApartmentAssignment[]>();
  for (const a of apartment.active_assignments) {
    const list = assignmentsByRoom.get(a.room_id) ?? [];
    list.push(a);
    assignmentsByRoom.set(a.room_id, list);
  }

  return (
    <div className="space-y-4">
      {/* Top strip — back button + edit / delete affordances */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/buildings/${buildingId}#layout`)}
          className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-[var(--admin-text-muted)] hover:text-navy dark:hover:text-[var(--admin-text)] transition-colors w-fit"
        >
          <BackIcon size={16} />
          {t('backToBuilding')}
        </button>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link
              href={`/${locale}/admin/buildings/${buildingId}/apartments/${apartment.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
            >
              <Pencil size={14} />
              {t('editApartment')}
            </Link>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} />
              {t('deleteApartment')}
            </button>
          )}
        </div>
      </div>

      {/* Header card */}
      <section className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-coral/10 text-coral flex items-center justify-center flex-shrink-0">
              <HomeIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-navy dark:text-[var(--admin-text)]">
                  {t('title', { number: apartment.apartment_number })}
                </h1>
                {isDefault && (
                  <DefaultApartmentTag
                    title={t('defaultTagTitle')}
                    label={t('defaultTagShort')}
                  />
                )}
              </div>
              <Link
                href={`/${locale}/admin/buildings/${buildingId}#layout=floor-${apartment.floor}`}
                className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-coral/10 text-coral text-xs font-medium hover:bg-coral/15 transition-colors"
                aria-label={t('floorChipAria', { n: apartment.floor })}
              >
                <Layers size={12} />
                <span>{t('floorN', { n: apartment.floor })}</span>
                <ForwardChevron size={12} />
              </Link>
            </div>
          </div>
          <StatusBadge
            label={apartment.is_active ? t('active') : t('inactive')}
            variant={apartment.is_active ? 'success' : 'neutral'}
          />
        </div>

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat
            label={t('totalRooms')}
            value={apartment.stats.rooms_count}
            icon={DoorOpen}
          />
          <Stat
            label={t('totalCapacity')}
            value={apartment.stats.total_capacity}
            icon={Users}
          />
          <Stat
            label={t('activeResidents')}
            value={apartment.stats.active_residents_count}
            icon={Users}
            accent
          />
        </div>

        {/* Layout chips */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Chip
            icon={ChefHat}
            label={apartment.has_kitchen ? t('kitchenYes') : t('kitchenNo')}
            active={apartment.has_kitchen}
          />
          <Chip
            icon={Sofa}
            label={apartment.has_living_room ? t('livingRoomYes') : t('livingRoomNo')}
            active={apartment.has_living_room}
          />
          <Chip
            icon={Bath}
            label={t('bathroomsLabel', {
              shared: apartment.shared_bathroom_count,
              priv: apartment.private_bathroom_count,
            })}
            active
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Rooms grid */}
          <Section title={t('sections.rooms')} icon={DoorOpen}>
            {apartment.rooms.length === 0 ? (
              <div className="text-center py-8">
                <DoorOpen size={32} className="mx-auto text-gray-300 dark:text-[var(--admin-text-subtle)] mb-2" />
                <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">{t('noRooms')}</p>
                {canAddRoom && (
                  <Link
                    href={`/${locale}/admin/buildings/${buildingId}/rooms/new?apartmentId=${apartment.id}`}
                    className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
                  >
                    <Plus size={14} />
                    {t('addRoom')}
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {apartment.rooms.map((room) => {
                    const occupants = assignmentsByRoom.get(room.id) ?? [];
                    return (
                      <RoomCard
                        key={room.id}
                        room={room}
                        occupants={occupants}
                        href={`/${locale}/admin/buildings/${buildingId}/rooms/${room.id}/edit`}
                        statusLabel={tStatus(room.status)}
                        typeLabel={tType(room.room_type)}
                        occupiedLabel={t('occupiedBy')}
                        vacantLabel={t('vacantShort')}
                        unnumberedLabel={t('roomUnnumbered')}
                        roomLabelTpl={(n) => t('roomLabel', { number: n })}
                      />
                    );
                  })}
                </div>
                {canAddRoom && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[var(--admin-border)]">
                    <Link
                      href={`/${locale}/admin/buildings/${buildingId}/rooms/new?apartmentId=${apartment.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
                    >
                      <Plus size={14} />
                      {t('addRoom')}
                    </Link>
                  </div>
                )}
              </>
            )}
          </Section>

          {/* Active residents */}
          <Section title={t('sections.residents')} icon={Users}>
            {apartment.active_assignments.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-[var(--admin-text-subtle)] italic">
                {t('noResidents')}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-[var(--admin-border)]">
                {apartment.active_assignments.map((a) => {
                  const room = apartment.rooms.find((r) => r.id === a.room_id);
                  const roomNumber = room?.room_number ?? null;
                  return (
                    <li
                      key={a.id}
                      className="flex items-start justify-between py-3 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-navy/10 text-navy dark:text-[var(--admin-text)] flex items-center justify-center font-medium text-xs flex-shrink-0">
                          {initials(a.resident?.full_name ?? '?')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-navy dark:text-[var(--admin-text)] truncate">
                            {a.resident?.full_name ?? t('unknownResident')}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">
                            {roomNumber
                              ? t('roomLabel', { number: roomNumber })
                              : t('roomUnnumbered')}
                            {' · '}
                            {formatDate(a.check_in_date, locale)}
                          </p>
                        </div>
                      </div>
                      <StatusBadge label={t('active')} variant="success" />
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Description */}
          {(description || apartment.notes) && (
            <Section title={t('sections.description')} icon={FileText}>
              {description ? (
                <p className="text-sm text-gray-700 dark:text-[var(--admin-text-muted)] whitespace-pre-line">
                  {description}
                </p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-[var(--admin-text-subtle)] italic">
                  {t('noDescription')}
                </p>
              )}
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Building reference */}
          {apartment.building && buildingLabel && (
            <Section title={t('sections.building')} icon={HomeIcon}>
              <Link
                href={`/${locale}/admin/buildings/${apartment.building.id}`}
                className="flex items-center justify-between text-sm text-coral hover:text-coral/80 font-medium gap-2"
              >
                <span className="truncate">{buildingLabel}</span>
                <ExternalLink size={14} className="flex-shrink-0" />
              </Link>
            </Section>
          )}

          {/* Notes */}
          <Section title={t('sections.notes')} icon={StickyNote}>
            {apartment.notes ? (
              <p className="text-sm text-gray-700 dark:text-[var(--admin-text-muted)] whitespace-pre-line">
                {apartment.notes}
              </p>
            ) : (
              <p className="text-sm text-gray-400 dark:text-[var(--admin-text-subtle)] italic">
                {t('noNotes')}
              </p>
            )}
          </Section>

          {/* Metadata */}
          <Section title={t('sections.metadata')}>
            <dl className="space-y-2 text-sm">
              <Meta label={t('createdAt')}>
                {formatDate(apartment.created_at, locale)}
              </Meta>
              <Meta label={t('updatedAt')}>
                {formatDate(apartment.updated_at, locale)}
              </Meta>
            </dl>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => (deleting ? null : setShowDeleteConfirm(false))}
        onConfirm={handleDelete}
        title={tForm('deleteConfirm.title')}
        description={tForm('deleteConfirm.description')}
        confirmLabel={
          deleting ? tForm('deleting') : tForm('deleteConfirm.confirm')
        }
        cancelLabel={tForm('deleteConfirm.cancel')}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

function RoomCard({
  room,
  occupants,
  href,
  statusLabel,
  typeLabel,
  occupiedLabel,
  vacantLabel,
  unnumberedLabel,
  roomLabelTpl,
}: {
  room: ApartmentRoom;
  occupants: ApartmentAssignment[];
  href: string;
  statusLabel: string;
  typeLabel: string;
  occupiedLabel: string;
  vacantLabel: string;
  unnumberedLabel: string;
  roomLabelTpl: (n: string) => string;
}) {
  const headerLabel = room.room_number
    ? roomLabelTpl(room.room_number)
    : unnumberedLabel;
  const isOccupied = occupants.length > 0;
  const occupant = occupants[0]?.resident;

  return (
    <Link
      href={href}
      className="group block bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] rounded-lg p-3 hover:border-coral/60 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy dark:text-[var(--admin-text)] truncate">
            {headerLabel}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-[var(--admin-text-muted)] truncate">
            {typeLabel}
          </p>
        </div>
        <StatusBadge
          label={statusLabel}
          variant={getRoomStatusVariant(room.status)}
        />
      </div>
      <div className="text-[11px] text-gray-500 dark:text-[var(--admin-text-muted)] mt-1">
        {isOccupied && occupant ? (
          <span>
            {occupiedLabel}: <span className="text-navy dark:text-[var(--admin-text)] font-medium">{occupant.full_name}</span>
            {occupants.length > 1 && (
              <span className="text-gray-400 dark:text-[var(--admin-text-subtle)] ms-1">+{occupants.length - 1}</span>
            )}
          </span>
        ) : (
          <span className="text-emerald-700 dark:text-emerald-300">{vacantLabel}</span>
        )}
      </div>
    </Link>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof HomeIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-navy dark:text-[var(--admin-text)] mb-3">
        {Icon && <Icon size={16} className="text-gray-400 dark:text-[var(--admin-text-subtle)]" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof DoorOpen;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        accent
          ? 'border-coral/30 bg-coral/5'
          : 'border-gray-100 dark:border-[var(--admin-border)] bg-gray-50/60 dark:bg-[var(--admin-surface-2)]/60'
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-[var(--admin-text-muted)] uppercase tracking-wide">
        <Icon size={12} className={accent ? 'text-coral' : ''} />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          accent ? 'text-coral' : 'text-navy dark:text-[var(--admin-text)]'
        )}
        dir="ltr"
      >
        {value}
      </p>
    </div>
  );
}

function Chip({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof ChefHat;
  label: string;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full border',
        active
          ? 'bg-navy/5 border-navy/20 text-navy dark:bg-[var(--admin-surface-2)] dark:border-[var(--admin-border)] dark:text-[var(--admin-text)]'
          : 'bg-gray-50 border-gray-100 text-gray-400 dark:bg-[var(--admin-surface-2)]/40 dark:border-[var(--admin-border)] dark:text-[var(--admin-text-subtle)]'
      )}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] uppercase tracking-wide">{label}</dt>
      <dd className="text-gray-700 dark:text-[var(--admin-text-muted)]">{children}</dd>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase() || '?';
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-9 w-40 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse" />
      <div className="h-40 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-xl animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-48 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-xl animate-pulse" />
          <div className="h-48 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-xl animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-32 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-xl animate-pulse" />
          <div className="h-32 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

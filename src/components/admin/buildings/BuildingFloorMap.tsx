'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bed,
  Wrench,
  Clock,
  LayoutGrid,
  Home as HomeIcon,
  ArrowRight,
  ArrowLeft,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  Layers,
  List as ListIcon,
  X,
} from 'lucide-react';
import EmptyState from '@/components/admin/shared/EmptyState';
import StatusBadge from '@/components/admin/shared/StatusBadge';
import RoomDetailPanel from './RoomDetailPanel';
import DefaultApartmentTag from './DefaultApartmentTag';
import BuildingRoomsTab from './BuildingRoomsTab';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/hooks';
import {
  getRoomBuckets as getRoomBucketsShared,
  type RoomBuckets,
  type RoomOccupancyInput,
} from '@/lib/rooms/occupancy';
import { isAutoApartmentNumber } from '@/lib/apartments/auto-name';
import type { ApartmentListItem } from '@/lib/apartments/types';

export interface ActiveAssignmentLite {
  id: string;
  resident_id: string;
  resident_name: string;
}

export interface FloorMapRoom {
  id: string;
  room_number: string | null;
  floor: number | null;
  room_type: string;
  capacity: number;
  occupancy_mode: 'private' | 'shared';
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  active_assignments_count: number;
  active_assignments: ActiveAssignmentLite[];
  apartment_id: string | null;
  apartment: { id: string; apartment_number: string; floor: number } | null;
}

interface BuildingFloorMapProps {
  buildingId: string;
  rooms: FloorMapRoom[];
  // false → caller can't read residents/assignments under RLS. We fall back
  // to a status-only view (room.status drives bucket counts and bar tones,
  // resident names + the partial / over-capacity affordances are hidden).
  // The previous behavior — querying as them and silently rendering empty
  // bars — looked like every building was vacant.
  canViewOccupants: boolean;
  // Bumped when a child mutation (room/apartment add/delete) lands so the
  // parent BuildingDetail can refresh tab badges and the rooms prop.
  onMutate?: () => void;
}

type TileTone = 'vacant' | 'occupied' | 'maintenance' | 'reserved';
type ViewMode = 'visual' | 'list';

const toneStyles: Record<TileTone, { card: string; tile: string; text: string }> = {
  vacant: {
    card: 'bg-emerald-500',
    tile: 'bg-emerald-500 text-white',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  occupied: {
    card: 'bg-coral',
    tile: 'bg-coral text-white',
    text: 'text-coral',
  },
  maintenance: {
    card: 'bg-amber-500',
    tile: 'bg-amber-500 text-white',
    text: 'text-amber-700 dark:text-amber-300',
  },
  reserved: {
    card: 'bg-navy',
    tile: 'bg-navy text-white',
    text: 'text-navy dark:text-[var(--admin-text)]',
  },
};

function toneIcon(tone: TileTone) {
  switch (tone) {
    case 'maintenance':
      return Wrench;
    case 'reserved':
      return Clock;
    default:
      return Bed;
  }
}

function toInput(room: FloorMapRoom): RoomOccupancyInput {
  return {
    capacity: room.capacity,
    occupancy_mode: room.occupancy_mode,
    status: room.status,
    active_assignments_count: room.active_assignments_count,
  };
}

function getRoomBuckets(room: FloorMapRoom): RoomBuckets {
  return getRoomBucketsShared(toInput(room));
}

// Status-only buckets for callers that can't read assignments under RLS.
// Coarser than getRoomBuckets (a private room marked 'occupied' counts every
// bed as occupied here, even if only one is taken) but it's the most we can
// say truthfully without occupant data.
function getStatusBuckets(room: FloorMapRoom): RoomBuckets {
  const capacity = Math.max(1, room.capacity);
  switch (room.status) {
    case 'maintenance':
    case 'reserved':
      return { occupied: 0, vacant: 0, unavailable: capacity, capacity };
    case 'occupied':
      return { occupied: capacity, vacant: 0, unavailable: 0, capacity };
    case 'available':
    default:
      return { occupied: 0, vacant: capacity, unavailable: 0, capacity };
  }
}

function bucketsFor(room: FloorMapRoom, canViewOccupants: boolean): RoomBuckets {
  return canViewOccupants ? getRoomBuckets(room) : getStatusBuckets(room);
}

// Tone is derived from buckets, not room.status, so the bar/pill stay in sync
// when room.status drifts from the active-assignment count (the check-out
// route's room.status update is best-effort/non-transactional). In status-only
// mode (canViewOccupants=false), buckets fall back to room.status, so this
// reduces to "use room.status directly".
function getRoomTone(room: FloorMapRoom, canViewOccupants: boolean): TileTone {
  const b = bucketsFor(room, canViewOccupants);
  if (b.unavailable > 0) {
    return room.status === 'maintenance' ? 'maintenance' : 'reserved';
  }
  return b.occupied >= b.capacity ? 'occupied' : 'vacant';
}

function toneToStatusKey(tone: TileTone): FloorMapRoom['status'] {
  return tone === 'vacant' ? 'available' : tone;
}

interface ApartmentGroup {
  key: string;
  apartmentId: string | null;
  apartmentNumber: string | null;
  floor: number | null;
  isActive: boolean;
  // null when the apartment isn't in the apartments fetch (e.g. unknown bucket
  // or the fetch failed); in that case we hide the residents tail.
  activeResidentsCount: number | null;
  rooms: FloorMapRoom[];
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  unavailableBeds: number;
}

interface FloorGroup {
  key: string;
  floor: number | null;
  apartments: ApartmentGroup[];
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  unavailableBeds: number;
  roomsCount: number;
}

function buildGroups(
  apartments: ApartmentListItem[],
  rooms: FloorMapRoom[],
  canViewOccupants: boolean
): FloorGroup[] {
  // Apartments are the primary spine: an apartment with zero rooms still gets
  // a card so the admin can add the first room. Rooms whose apartment isn't in
  // our fetch (rare — RLS or stale data) fall into a `__unknown` bucket per
  // floor so they never disappear.
  const floorMap = new Map<string, FloorGroup>();
  const aptIndex = new Map<string, ApartmentGroup>();

  function ensureFloor(floor: number | null): FloorGroup {
    const key = floor === null ? '__unassigned' : String(floor);
    let f = floorMap.get(key);
    if (!f) {
      f = {
        key,
        floor,
        apartments: [],
        totalBeds: 0,
        occupiedBeds: 0,
        vacantBeds: 0,
        unavailableBeds: 0,
        roomsCount: 0,
      };
      floorMap.set(key, f);
    }
    return f;
  }

  for (const a of apartments) {
    const f = ensureFloor(a.floor);
    const apt: ApartmentGroup = {
      key: a.id,
      apartmentId: a.id,
      apartmentNumber: a.apartment_number,
      floor: a.floor,
      isActive: a.is_active,
      activeResidentsCount: a.active_residents_count,
      rooms: [],
      totalBeds: 0,
      occupiedBeds: 0,
      vacantBeds: 0,
      unavailableBeds: 0,
    };
    f.apartments.push(apt);
    aptIndex.set(a.id, apt);
  }

  for (const r of rooms) {
    let apt: ApartmentGroup | undefined = r.apartment_id
      ? aptIndex.get(r.apartment_id)
      : undefined;
    if (!apt) {
      // Synthetic "unknown" group for orphan rooms.
      const f = ensureFloor(r.floor);
      const key = `__unknown_${f.key}`;
      apt = f.apartments.find((x) => x.key === key);
      if (!apt) {
        apt = {
          key,
          apartmentId: null,
          apartmentNumber: r.apartment?.apartment_number ?? null,
          floor: r.floor,
          isActive: true,
          activeResidentsCount: null,
          rooms: [],
          totalBeds: 0,
          occupiedBeds: 0,
          vacantBeds: 0,
          unavailableBeds: 0,
        };
        f.apartments.push(apt);
      }
    }
    apt.rooms.push(r);
    const buckets = bucketsFor(r, canViewOccupants);
    apt.totalBeds += r.capacity;
    apt.occupiedBeds += buckets.occupied;
    apt.vacantBeds += buckets.vacant;
    apt.unavailableBeds += buckets.unavailable;

    const f = ensureFloor(apt.floor);
    f.totalBeds += r.capacity;
    f.occupiedBeds += buckets.occupied;
    f.vacantBeds += buckets.vacant;
    f.unavailableBeds += buckets.unavailable;
    f.roomsCount += 1;
  }

  const floors = Array.from(floorMap.values());
  // Numbered floors descend (top floor first); unassigned trails.
  floors.sort((a, b) => {
    if (a.floor === null && b.floor === null) return 0;
    if (a.floor === null) return 1;
    if (b.floor === null) return -1;
    return b.floor - a.floor;
  });

  for (const f of floors) {
    f.apartments.sort((a, b) => {
      if (a.apartmentNumber === null && b.apartmentNumber === null) return 0;
      if (a.apartmentNumber === null) return 1;
      if (b.apartmentNumber === null) return -1;
      return a.apartmentNumber.localeCompare(b.apartmentNumber, 'en', {
        numeric: true,
      });
    });
    for (const apt of f.apartments) {
      apt.rooms.sort((x, y) => {
        const xNum = x.room_number ?? '';
        const yNum = y.room_number ?? '';
        return xNum.localeCompare(yNum, 'en', { numeric: true });
      });
    }
  }
  return floors;
}

export default function BuildingFloorMap({
  buildingId,
  rooms,
  canViewOccupants,
  onMutate,
}: BuildingFloorMapProps) {
  const t = useTranslations('admin.buildings.floorMap');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const ChevronInline = isArabic ? ArrowLeft : ArrowRight;
  const { profile } = useAuth();
  const canCreateApartment =
    !!profile &&
    (profile.role === 'super_admin' || profile.role === 'deputy_general_manager');
  const canCreateRoom = canCreateApartment;

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [apartments, setApartments] = useState<ApartmentListItem[]>([]);
  const [apartmentsLoading, setApartmentsLoading] = useState(true);
  const [apartmentsError, setApartmentsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [collapsedFloors, setCollapsedFloors] = useState<Set<number>>(new Set());

  // `#layout=floor-N` deep-links from ApartmentDetail's floor chip; `#layout=flat`
  // and `#floorMap=list` pre-select the list view. Read once on mount.
  const [anchoredFloor] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const m = window.location.hash.match(/^#layout=floor-(-?\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  });
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'visual';
    const h = window.location.hash;
    return h === '#layout=flat' || h === '#floorMap=list' ? 'list' : 'visual';
  });

  function setViewMode(next: ViewMode) {
    setViewModeState(next);
    if (typeof window !== 'undefined') {
      const hash = next === 'list' ? '#floorMap=list' : '#floorMap';
      const url = `${window.location.pathname}${window.location.search}${hash}`;
      window.history.replaceState(null, '', url);
    }
  }

  // Per-building, session-scoped dismissal so the user can quiet the defaults
  // nudge without losing it forever.
  const dismissKey = `sakan-defaults-banner-${buildingId}`;
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem(dismissKey) === '1';
    } catch {
      return false;
    }
  });
  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try {
      window.sessionStorage.setItem(dismissKey, '1');
    } catch {
      // sessionStorage can be unavailable (private browsing); the in-memory
      // dismissal still works for this session.
    }
  }, [dismissKey]);

  const handleMutate = useCallback(() => {
    setReloadKey((k) => k + 1);
    onMutate?.();
  }, [onMutate]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setApartmentsLoading(true);
      setApartmentsError(false);
      try {
        const res = await fetch(`/api/admin/buildings/${buildingId}/apartments`);
        if (cancelled) return;
        if (!res.ok) {
          setApartmentsError(true);
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setApartments(json.data ?? []);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load apartments:', err);
          setApartmentsError(true);
        }
      } finally {
        if (!cancelled) setApartmentsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [buildingId, reloadKey]);

  const totals = useMemo(() => {
    let totalBeds = 0;
    let occupiedBeds = 0;
    let unavailableBeds = 0;
    for (const r of rooms) {
      totalBeds += r.capacity;
      const buckets = bucketsFor(r, canViewOccupants);
      occupiedBeds += buckets.occupied;
      unavailableBeds += buckets.unavailable;
    }
    const rentableBeds = totalBeds - unavailableBeds;
    const vacantBeds = rentableBeds - occupiedBeds;
    const vacancyPct =
      rentableBeds > 0 ? Math.round((vacantBeds / rentableBeds) * 100) : 0;
    return { totalBeds, occupiedBeds, vacantBeds, unavailableBeds, vacancyPct };
  }, [rooms, canViewOccupants]);

  const groups = useMemo(
    () => buildGroups(apartments, rooms, canViewOccupants),
    [apartments, rooms, canViewOccupants]
  );

  const numberedFloors = useMemo(
    () =>
      groups
        .map((g) => g.floor)
        .filter((f): f is number => f !== null),
    [groups]
  );

  // Once apartments load, collapse every floor except the top one — OR the
  // anchored floor when navigating in via `#layout=floor-N`. Skip if the
  // user has already toggled anything.
  const [appliedDefaultCollapse, setAppliedDefaultCollapse] = useState(false);
  useEffect(() => {
    if (
      apartmentsLoading ||
      appliedDefaultCollapse ||
      numberedFloors.length === 0
    )
      return;
    const expandFloor =
      anchoredFloor !== null && numberedFloors.includes(anchoredFloor)
        ? anchoredFloor
        : numberedFloors[0];
    const next = new Set<number>();
    for (const f of numberedFloors) {
      if (f !== expandFloor) next.add(f);
    }
    setCollapsedFloors(next);
    setAppliedDefaultCollapse(true);
  }, [apartmentsLoading, appliedDefaultCollapse, numberedFloors, anchoredFloor]);

  // After the anchored floor mounts + expands, scroll it into view. One-shot:
  // re-fetches (mutation -> reloadKey++) must NOT keep bouncing the user back.
  const [scrolledToAnchor, setScrolledToAnchor] = useState(false);
  useEffect(() => {
    if (!appliedDefaultCollapse || anchoredFloor === null || scrolledToAnchor)
      return;
    if (!numberedFloors.includes(anchoredFloor)) return;
    const el = document.getElementById(`layout-floor-${anchoredFloor}`);
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrolledToAnchor(true);
    });
  }, [appliedDefaultCollapse, anchoredFloor, numberedFloors, scrolledToAnchor]);

  function toggleFloor(floor: number) {
    setCollapsedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor);
      else next.add(floor);
      return next;
    });
  }
  function expandAll() {
    setCollapsedFloors(new Set());
  }
  function collapseAll() {
    setCollapsedFloors(new Set(numberedFloors));
  }

  const defaultApartments = apartments.filter((a) =>
    isAutoApartmentNumber(a.apartment_number)
  );
  const showDefaultsBanner =
    !bannerDismissed &&
    defaultApartments.length > 0 &&
    !apartmentsLoading &&
    !apartmentsError &&
    canCreateApartment;
  const firstDefault = defaultApartments[0];

  const viewToggle = (
    <div className="inline-flex items-center bg-white dark:bg-[var(--admin-surface)] rounded-lg border border-gray-200 dark:border-[var(--admin-border)] p-0.5 shadow-sm">
      <ViewModeButton
        active={viewMode === 'visual'}
        onClick={() => setViewMode('visual')}
        icon={Layers}
        label={t('viewVisual')}
      />
      <ViewModeButton
        active={viewMode === 'list'}
        onClick={() => setViewMode('list')}
        icon={ListIcon}
        label={t('viewList')}
      />
    </div>
  );

  if (selectedRoomId) {
    return (
      <RoomDetailPanel
        roomId={selectedRoomId}
        onBack={() => setSelectedRoomId(null)}
      />
    );
  }

  // List mode: hand off to the existing rooms-tab UI. Its filter bar, table,
  // bulk actions, and RoomDetailPanel routing are unchanged.
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{viewToggle}</div>
        <BuildingRoomsTab buildingId={buildingId} onMutate={handleMutate} />
      </div>
    );
  }

  if (apartmentsError) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{viewToggle}</div>
        <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)]">
          <EmptyState
            icon={LayoutGrid}
            title={t('errorTitle')}
            description={t('errorDescription')}
          />
        </div>
      </div>
    );
  }

  if (apartmentsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{viewToggle}</div>
        <LayoutSkeleton />
      </div>
    );
  }

  if (apartments.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{viewToggle}</div>
        <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)]">
          <EmptyState
            icon={LayoutGrid}
            title={t('emptyTitle')}
            description={
              canCreateApartment
                ? t('emptyDescription')
                : t('emptyDescriptionStaff')
            }
          />
          {canCreateApartment && (
            <div className="flex justify-center pb-6 -mt-4">
              <Link
                href={`/${locale}/admin/buildings/${buildingId}/apartments/new`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
              >
                <Plus size={14} />
                {t('addApartment')}
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  const allCollapsed =
    numberedFloors.length > 0 && collapsedFloors.size === numberedFloors.length;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{viewToggle}</div>

      {showDefaultsBanner && firstDefault ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 flex items-start gap-3">
          <Sparkles
            size={18}
            className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {t('defaultsBannerTitle')}
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-200/80 mt-1">
              {t('defaultsBannerDescription', { count: defaultApartments.length })}
            </p>
            <Link
              href={`/${locale}/admin/buildings/${buildingId}/apartments/${firstDefault.id}/edit`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-100 hover:underline"
            >
              {t('defaultsBannerCta')}
              <ChevronInline size={14} />
            </Link>
          </div>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label={t('defaultsBannerDismiss')}
            className="text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/15 rounded p-1 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      {canViewOccupants ? (
        <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryStat label={t('summaryTotal')} value={totals.totalBeds} />
            <SummaryStat
              label={t('summaryOccupied')}
              value={totals.occupiedBeds}
              tone="occupied"
            />
            <SummaryStat
              label={t('summaryVacant')}
              value={totals.vacantBeds}
              tone="vacant"
            />
            <SummaryStat
              label={t('summaryPercent')}
              value={totals.vacancyPct}
              suffix="%"
              tone="vacant"
              info={t('summaryPercentTooltip')}
            />
          </div>
        </div>
      ) : (
        <NoOccupantAccessBanner />
      )}

      <Legend showPartial={canViewOccupants} />

      {numberedFloors.length > 0 && (
        <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">
            <ChevronInline size={12} className="text-gray-300 dark:text-[var(--admin-text-subtle)]" />
            <span>{t('hint')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={allCollapsed ? expandAll : collapseAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-[var(--admin-text-muted)] hover:text-navy dark:hover:text-[var(--admin-text)] hover:bg-gray-50 dark:hover:bg-[var(--admin-surface-2)] rounded-lg transition-colors"
            >
              {allCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              {allCollapsed ? t('expandAll') : t('collapseAll')}
            </button>
            {canCreateApartment && (
              <Link
                href={`/${locale}/admin/buildings/${buildingId}/apartments/new`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-coral text-white text-xs font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm whitespace-nowrap"
              >
                <Plus size={12} />
                {t('addApartment')}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((floorGroup) => {
          const floorLabel =
            floorGroup.floor === null
              ? t('floorUnassigned')
              : t('floorLabel', { floor: floorGroup.floor });
          const summary = canViewOccupants
            ? t('floorSummary', {
                vacant: floorGroup.vacantBeds,
                total: floorGroup.totalBeds,
              })
            : t('floorSummaryRoomsOnly', { rooms: floorGroup.roomsCount });
          const isCollapsible = floorGroup.floor !== null;
          const isCollapsed =
            isCollapsible && collapsedFloors.has(floorGroup.floor!);

          return (
            <section
              key={floorGroup.key}
              id={
                floorGroup.floor !== null
                  ? `layout-floor-${floorGroup.floor}`
                  : undefined
              }
              className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] overflow-hidden scroll-mt-4"
            >
              {isCollapsible ? (
                <button
                  type="button"
                  onClick={() => toggleFloor(floorGroup.floor!)}
                  className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50 dark:hover:bg-[var(--admin-surface-2)] transition-colors text-start border-b border-gray-100 dark:border-[var(--admin-border)] bg-gray-50/60 dark:bg-[var(--admin-surface-2)]/60"
                  aria-expanded={!isCollapsed}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isCollapsed ? (
                      <ChevronDown size={16} className="text-gray-400 dark:text-[var(--admin-text-subtle)] flex-shrink-0" />
                    ) : (
                      <ChevronUp size={16} className="text-gray-400 dark:text-[var(--admin-text-subtle)] flex-shrink-0" />
                    )}
                    <h3 className="text-sm font-semibold text-navy dark:text-[var(--admin-text)]">
                      {floorLabel}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] tabular-nums truncate">
                      {summary}
                    </span>
                  </div>
                </button>
              ) : (
                <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-[var(--admin-border)] bg-gray-50/60 dark:bg-[var(--admin-surface-2)]/60">
                  <h3 className="text-sm font-semibold text-navy dark:text-[var(--admin-text)]">{floorLabel}</h3>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] tabular-nums">{summary}</p>
                </header>
              )}

              {!isCollapsed && (
                <div className="p-4 sm:p-5 space-y-4">
                  {floorGroup.apartments.map((apt) => {
                    const isDefault = isAutoApartmentNumber(apt.apartmentNumber);
                    // Summary variants:
                    // - 0 rooms → rooms-only ("0 rooms"); the bed/resident
                    //   counts are all zero anyway, and the placeholder card
                    //   below already says "No rooms in this apartment yet".
                    // - canViewOccupants + residents known → rooms · vacant/total · residents
                    // - canViewOccupants only → rooms · vacant/total
                    // - status-only → rooms only (bed counts aren't real)
                    let aptSummary: string;
                    if (apt.rooms.length === 0) {
                      aptSummary = t('apartmentSummaryRoomsOnly', {
                        rooms: 0,
                      });
                    } else if (
                      canViewOccupants &&
                      apt.activeResidentsCount !== null
                    ) {
                      aptSummary = t('apartmentSummaryWithResidents', {
                        rooms: apt.rooms.length,
                        vacant: apt.vacantBeds,
                        total: apt.totalBeds,
                        residents: apt.activeResidentsCount,
                      });
                    } else if (canViewOccupants) {
                      aptSummary = t('apartmentSummary', {
                        rooms: apt.rooms.length,
                        vacant: apt.vacantBeds,
                        total: apt.totalBeds,
                      });
                    } else {
                      aptSummary = t('apartmentSummaryRoomsOnly', {
                        rooms: apt.rooms.length,
                      });
                    }
                    return (
                      <div
                        key={apt.key}
                        className="rounded-lg border border-gray-200 dark:border-[var(--admin-border)] bg-gray-50/40 dark:bg-[var(--admin-surface-2)]/40"
                      >
                        <ApartmentHeader
                          buildingId={buildingId}
                          locale={locale}
                          apartmentId={apt.apartmentId}
                          apartmentNumber={apt.apartmentNumber}
                          unknownLabel={t('apartmentUnknown')}
                          summary={aptSummary}
                          isDefault={isDefault}
                          isActive={apt.isActive}
                          inactiveLabel={t('apartmentInactive')}
                          defaultTagShort={t('apartmentDefaultShort')}
                          defaultTagTitle={t('apartmentDefaultTitle')}
                          ChevronIcon={ChevronInline}
                        />
                        {apt.rooms.length === 0 ? (
                          <div className="m-3 sm:m-4 mt-2 sm:mt-3 flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-white dark:bg-[var(--admin-surface)] border border-dashed border-gray-200 dark:border-[var(--admin-border)]">
                            <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] italic">
                              {t('noRoomsInApartment')}
                            </p>
                            {canCreateRoom && apt.apartmentId && (
                              <Link
                                href={`/${locale}/admin/buildings/${buildingId}/rooms/new?apartmentId=${apt.apartmentId}`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-coral hover:text-coral/80 transition-colors whitespace-nowrap"
                              >
                                <Plus size={12} />
                                {t('addRoom')}
                              </Link>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 sm:p-4 pt-2 sm:pt-3">
                            {apt.rooms.map((room) => (
                              <RoomCard
                                key={room.id}
                                room={room}
                                canViewOccupants={canViewOccupants}
                                onSelect={() => setSelectedRoomId(room.id)}
                              />
                            ))}
                            {canCreateRoom && apt.apartmentId && (
                              <Link
                                href={`/${locale}/admin/buildings/${buildingId}/rooms/new?apartmentId=${apt.apartmentId}`}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-[var(--admin-border)] text-xs font-medium text-gray-500 dark:text-[var(--admin-text-muted)] hover:border-coral hover:text-coral hover:bg-coral/5 dark:hover:bg-coral/10 transition-all min-h-[5.5rem]"
                              >
                                <Plus size={14} />
                                {t('addRoom')}
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('clickHint')}</p>
    </div>
  );
}

function ViewModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Layers;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
        active
          ? 'bg-coral text-white shadow-sm'
          : 'text-gray-600 dark:text-[var(--admin-text-muted)] hover:text-navy dark:hover:text-[var(--admin-text)] hover:bg-gray-50 dark:hover:bg-[var(--admin-surface-2)]'
      )}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

function SummaryStat({
  label,
  value,
  suffix,
  tone,
  info,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: TileTone;
  info?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-[var(--admin-border)] bg-gray-50/60 dark:bg-[var(--admin-surface-2)]/60 p-3">
      <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-[var(--admin-text-muted)] uppercase tracking-wide">
        <span>{label}</span>
        {info ? <InfoPopover text={info} /> : null}
      </p>
      <p
        className={cn(
          'mt-1 text-2xl font-bold tabular-nums',
          tone ? toneStyles[tone].text : 'text-navy dark:text-[var(--admin-text)]'
        )}
      >
        {value}
        {suffix ? <span className="text-base font-semibold ms-0.5">{suffix}</span> : null}
      </p>
    </div>
  );
}

// Click/tap-toggle popover. The previous `title` attribute was invisible on
// touch devices, leaving the explanation unreachable for admins on iPad/iPhone
// — and that explanation defuses the gap between the BedBar (physical view)
// and the Vacancy % stat (accounting view).
function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={text}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center text-gray-400 dark:text-[var(--admin-text-subtle)] hover:text-coral focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 rounded"
      >
        <Info size={12} aria-hidden="true" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute top-full mt-1 start-0 z-10 w-64 max-w-[80vw] rounded-md border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] p-2 text-xs normal-case font-normal tracking-normal text-gray-700 dark:text-[var(--admin-text-muted)] shadow-md"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

function Legend({ showPartial }: { showPartial: boolean }) {
  const t = useTranslations('admin.buildings.floorMap.legend');
  const items: Array<{ tone: TileTone; label: string }> = [
    { tone: 'vacant', label: t('vacant') },
    { tone: 'occupied', label: t('occupied') },
    { tone: 'maintenance', label: t('maintenance') },
    { tone: 'reserved', label: t('reserved') },
  ];
  return (
    <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-3 sm:p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-[var(--admin-text-muted)] uppercase tracking-wide mb-2">
        {t('title')}
      </p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map(({ tone, label }) => {
          const Icon = toneIcon(tone);
          return (
            <li key={tone} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex items-center justify-center w-6 h-6 rounded-md',
                  toneStyles[tone].tile
                )}
              >
                <Icon size={12} />
              </span>
              <span className="text-xs text-gray-700 dark:text-[var(--admin-text-muted)]">{label}</span>
            </li>
          );
        })}
        {/* Partial-occupied is occupant-derived; hide it in status-only mode
            so the legend doesn't advertise a state the bars can't render. */}
        {showPartial ? (
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex w-6 h-6 rounded-md overflow-hidden"
            >
              <span className={cn('flex-1', toneStyles.occupied.tile)} />
              <span className={cn('flex-1', toneStyles.vacant.tile)} />
            </span>
            <span className="text-xs text-gray-700 dark:text-[var(--admin-text-muted)]">
              {t('partial')}
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function NoOccupantAccessBanner() {
  const t = useTranslations('admin.buildings.floorMap');
  return (
    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 sm:p-4 flex items-start gap-3">
      <Info
        size={16}
        aria-hidden="true"
        className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"
      />
      <div>
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          {t('noOccupantAccessTitle')}
        </p>
        <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-1">
          {t('noOccupantAccessDescription')}
        </p>
      </div>
    </div>
  );
}

function ApartmentHeader({
  buildingId,
  locale,
  apartmentId,
  apartmentNumber,
  unknownLabel,
  summary,
  isDefault,
  isActive,
  inactiveLabel,
  defaultTagShort,
  defaultTagTitle,
  ChevronIcon,
}: {
  buildingId: string;
  locale: string;
  apartmentId: string | null;
  apartmentNumber: string | null;
  unknownLabel: string;
  summary: string;
  isDefault: boolean;
  isActive: boolean;
  inactiveLabel: string;
  defaultTagShort: string;
  defaultTagTitle: string;
  ChevronIcon: typeof ArrowRight;
}) {
  const inner = (
    <div className="flex items-center gap-2 min-w-0 flex-wrap">
      <HomeIcon
        size={14}
        className="text-gray-400 dark:text-[var(--admin-text-subtle)] flex-shrink-0"
      />
      <span
        className="text-sm font-semibold text-navy dark:text-[var(--admin-text)] truncate"
        dir="ltr"
      >
        {apartmentNumber ?? unknownLabel}
      </span>
      {isDefault && (
        <DefaultApartmentTag title={defaultTagTitle} label={defaultTagShort} />
      )}
      {!isActive && <StatusBadge label={inactiveLabel} variant="neutral" />}
      <span className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] tabular-nums">
        {summary}
      </span>
    </div>
  );

  if (!apartmentId) {
    return (
      <header className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 border-b border-gray-100 dark:border-[var(--admin-border)]">
        {inner}
      </header>
    );
  }

  return (
    <Link
      href={`/${locale}/admin/buildings/${buildingId}/apartments/${apartmentId}`}
      className="group flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 border-b border-gray-100 dark:border-[var(--admin-border)] hover:bg-coral/5 dark:hover:bg-coral/10 transition-colors"
    >
      {inner}
      <ChevronIcon
        size={14}
        className="text-gray-300 dark:text-[var(--admin-text-subtle)] group-hover:text-coral transition-colors flex-shrink-0"
      />
    </Link>
  );
}

// First letter of the first two words, uppercased. Works for AR + EN names
// because we only need code-point initials, not transliteration.
function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => Array.from(p)[0] ?? '').join('').toUpperCase() || '?';
}

function getFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '?';
  return trimmed.split(/\s+/)[0] ?? '?';
}

interface BedSegment {
  tone: TileTone;
  fullName?: string;
}

function buildBedSegments(
  room: FloorMapRoom,
  canViewOccupants: boolean
): BedSegment[] {
  const capacity = Math.max(1, room.capacity);
  if (room.status === 'maintenance') {
    return Array.from({ length: capacity }, () => ({ tone: 'maintenance' as TileTone }));
  }
  if (room.status === 'reserved') {
    return Array.from({ length: capacity }, () => ({ tone: 'reserved' as TileTone }));
  }
  // Status-only mode: no per-bed assignments are visible. Paint every segment
  // with the room-level tone (occupied → all coral, available → all emerald)
  // and hide names. We still render `capacity` segments so the bar visually
  // conveys room size.
  if (!canViewOccupants) {
    const tone: TileTone = room.status === 'occupied' ? 'occupied' : 'vacant';
    return Array.from({ length: capacity }, () => ({ tone }));
  }
  const segments: BedSegment[] = [];
  const occupied = room.active_assignments.slice(0, capacity);
  for (const a of occupied) {
    segments.push({ tone: 'occupied', fullName: a.resident_name || '?' });
  }
  while (segments.length < capacity) {
    segments.push({ tone: 'vacant' });
  }
  return segments;
}

function RoomCard({
  room,
  canViewOccupants,
  onSelect,
}: {
  room: FloorMapRoom;
  canViewOccupants: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations('admin.buildings.floorMap');
  const tStatus = useTranslations('admin.buildings.roomStatus');
  const tType = useTranslations('rooms.types');
  const tMode = useTranslations('rooms.occupancyMode');

  const tone = getRoomTone(room, canViewOccupants);
  const buckets = bucketsFor(room, canViewOccupants);
  const isUnavailable = buckets.unavailable > 0;
  const safeCapacity = Math.max(1, room.capacity);
  const physicallyOccupied = Math.min(
    room.active_assignments.length,
    safeCapacity
  );
  // Active assignments outliving the room's capacity (e.g., capacity edited
  // 3→2 while 3 actives existed; the enforce_room_capacity trigger only
  // gates assignment writes, not rooms.capacity edits). The bar can only
  // show `capacity` segments, so the extras are visually invisible — surface
  // a warning row so it's not silently swallowed. Only meaningful in the
  // occupant-visible mode; status-only callers don't see assignments at all.
  const isOverCapacity =
    canViewOccupants &&
    !isUnavailable &&
    room.active_assignments.length > safeCapacity;
  const isPartial =
    canViewOccupants &&
    !isUnavailable &&
    !isOverCapacity &&
    physicallyOccupied > 0 &&
    physicallyOccupied < safeCapacity;

  const headerLabel = room.room_number
    ? t('roomLabel', { number: room.room_number })
    : t('roomUnnumbered');

  // Use tone (derived from data) for the label so the pill never says
  // "Occupied" while the bar shows all-vacant segments.
  const statusLabel = isPartial
    ? t('partiallyOccupied')
    : tStatus(toneToStatusKey(tone));
  // In status-only mode the bed-level counts aren't real, so use a leaner
  // aria template that just names the room/type/mode/status.
  const ariaLabel = canViewOccupants
    ? t('cardAriaLabel', {
        room: headerLabel,
        type: tType(room.room_type),
        mode: tMode(room.occupancy_mode),
        occupied: physicallyOccupied,
        vacant: Math.max(0, safeCapacity - physicallyOccupied),
        capacity: room.capacity,
        status: statusLabel,
      })
    : t('cardAriaLabelStatusOnly', {
        room: headerLabel,
        type: tType(room.room_type),
        mode: tMode(room.occupancy_mode),
        capacity: room.capacity,
        status: statusLabel,
      });

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={ariaLabel}
      className="group cursor-pointer text-start bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] rounded-lg p-3 hover:border-coral/60 hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy dark:text-[var(--admin-text)] truncate">{headerLabel}</p>
          <p className="text-[11px] text-gray-500 dark:text-[var(--admin-text-muted)] truncate">
            {tType(room.room_type)} · {tMode(room.occupancy_mode)}
          </p>
        </div>
        <span
          className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap',
            isPartial
              ? 'bg-coral/10 text-coral'
              : tone === 'vacant' && 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            !isPartial && tone === 'occupied' && 'bg-coral/10 text-coral',
            !isPartial && tone === 'maintenance' && 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
            !isPartial && tone === 'reserved' && 'bg-navy/10 text-navy dark:text-[var(--admin-text)]'
          )}
        >
          {statusLabel}
        </span>
      </div>

      <BedBar room={room} canViewOccupants={canViewOccupants} />

      {isOverCapacity ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 tabular-nums">
          <AlertTriangle size={11} aria-hidden="true" className="flex-shrink-0" />
          {t('cardCapacityOverbooked', {
            residents: room.active_assignments.length,
            capacity: room.capacity,
          })}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-gray-500 dark:text-[var(--admin-text-muted)] tabular-nums">
          {isUnavailable
            ? t('cardCapacityUnavailable', { count: room.capacity })
            : canViewOccupants
              ? t('cardCapacityOccupied', {
                  occupied: physicallyOccupied,
                  capacity: room.capacity,
                })
              : t('cardCapacityStatusOnly', { capacity: room.capacity })}
        </p>
      )}
    </button>
  );
}

function BedBar({
  room,
  canViewOccupants,
}: {
  room: FloorMapRoom;
  canViewOccupants: boolean;
}) {
  const t = useTranslations('admin.buildings.floorMap');
  const segments = buildBedSegments(room, canViewOccupants);
  const capacity = Math.max(1, room.capacity);
  // Names get cramped past 3 segments — collapse to initials so each bed
  // still has an identifier the eye can land on.
  const useInitials = capacity >= 4;

  // No role="group"/aria-label on the wrapper: the parent button's
  // aria-label already names the room with occupied/vacant counts, and each
  // segment carries its own label — wrapping them adds redundancy SR users
  // have to skip past.
  return (
    <div className="flex h-14 gap-0.5 rounded-md overflow-hidden">
      {segments.map((seg, i) => {
        if (seg.tone === 'occupied' && seg.fullName) {
          const display = useInitials
            ? getInitials(seg.fullName)
            : getFirstName(seg.fullName);
          return (
            <div
              key={i}
              className={cn(
                'flex flex-1 items-center justify-center min-w-0 px-1',
                toneStyles[seg.tone].tile
              )}
              title={seg.fullName}
              aria-label={t('bedOccupiedLabel', { name: seg.fullName })}
            >
              <span className="text-xs font-semibold truncate">{display}</span>
            </div>
          );
        }
        const Icon = toneIcon(seg.tone);
        const ariaLabel =
          seg.tone === 'vacant'
            ? t('bedVacantLabel')
            : seg.tone === 'maintenance'
              ? t('legend.maintenance')
              : t('legend.reserved');
        return (
          <div
            key={i}
            className={cn(
              'flex flex-1 items-center justify-center min-w-0',
              toneStyles[seg.tone].tile
            )}
            aria-label={ariaLabel}
          >
            <Icon size={14} />
          </div>
        );
      })}
    </div>
  );
}

function LayoutSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-12 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-xl animate-pulse" />
      {[...Array(2)].map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] overflow-hidden"
        >
          <div className="h-12 bg-gray-50 dark:bg-[var(--admin-surface-2)] animate-pulse" />
          <div className="p-4 space-y-3">
            {[...Array(2)].map((_, j) => (
              <div
                key={j}
                className="border border-gray-100 dark:border-[var(--admin-border)] rounded-lg p-4 space-y-3"
              >
                <div className="h-5 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded w-32 animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...Array(3)].map((_, k) => (
                    <div
                      key={k}
                      className="h-32 bg-gray-50 dark:bg-[var(--admin-surface-2)] rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

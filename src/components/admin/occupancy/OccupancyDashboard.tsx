'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Activity, Bed, Clock, RefreshCw, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/admin/shared/EmptyState';
import { type BedStatus, vacancyPctOfRentable } from '@/lib/rooms/occupancy';

interface RoomOccupancy {
  id: string;
  room_number: string | null;
  floor: number | null;
  capacity: number;
  bed_statuses: BedStatus[];
}

interface BuildingOccupancy {
  id: string;
  slug: string;
  building_number: number | null;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
  total_beds: number;
  vacant_beds: number;
  occupied_beds: number;
  maintenance_beds: number;
  reserved_beds: number;
  rooms: RoomOccupancy[];
}

interface Totals {
  total_beds: number;
  vacant_beds: number;
  occupied_beds: number;
  maintenance_beds: number;
  reserved_beds: number;
}

type SortKey = 'most_empty' | 'name' | 'building_number';

const STATUS_COLORS: Record<BedStatus, string> = {
  vacant: 'bg-emerald-500',
  occupied: 'bg-coral',
  maintenance: 'bg-amber-500',
  reserved: 'bg-navy',
};

// Icon-per-bed so the heatmap doesn't rely on color alone (a11y + the
// project's "every tile must carry a glyph" rule). Icons stay subtle at the
// 14px tile size — they're discriminator hints, not decoration.
const STATUS_ICONS: Record<BedStatus, typeof Bed> = {
  vacant: Bed,
  occupied: Bed,
  maintenance: Wrench,
  reserved: Clock,
};

const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

// Vacancy % is computed against RENTABLE beds (total minus
// maintenance + reserved) so it stays consistent with BuildingFloorMap's
// summary. A building with 4 of 10 beds in maintenance and 3 vacant should
// read "50% empty" (3 of 6 rentable), not "30% empty".
function vacancyPct(b: BuildingOccupancy | Totals): number {
  return vacancyPctOfRentable(b);
}

export default function OccupancyDashboard() {
  const t = useTranslations('admin.occupancy');
  const locale = useLocale();
  const isArabic = locale === 'ar';

  const [buildings, setBuildings] = useState<BuildingOccupancy[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<SortKey>('most_empty');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/occupancy');
      if (!res.ok) throw new Error('Failed');
      const json = (await res.json()) as { totals: Totals; buildings: BuildingOccupancy[] };
      setTotals(json.totals);
      setBuildings(json.buildings || []);
      setLastRefreshed(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Drive a "x min ago" relative-time string that ticks every 30s without
  // re-fetching. The dashboard doesn't auto-refresh — bookings flow updates
  // are only visible after a manual refresh — but the staleness indicator
  // makes that obvious instead of misleading the user.
  useEffect(() => {
    const id = window.setInterval(() => setRefreshTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const refreshedLabel = useMemo(() => {
    if (!lastRefreshed) return null;
    const seconds = Math.max(0, Math.floor((Date.now() - lastRefreshed.getTime()) / 1000));
    if (seconds < 60) return t('refresh.justNow');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('refresh.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    return t('refresh.hoursAgo', { count: hours });
    // refreshTick is intentionally part of the dep list — it's the only
    // reason the relative-time string updates without a new fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRefreshed, refreshTick, t]);

  const sortedBuildings = useMemo(() => {
    const list = [...buildings];
    if (sort === 'most_empty') {
      list.sort((a, b) => vacancyPct(b) - vacancyPct(a));
    } else if (sort === 'name') {
      const collator = new Intl.Collator(isArabic ? 'ar' : 'en', { sensitivity: 'base' });
      list.sort((a, b) =>
        collator.compare(
          isArabic ? a.neighborhood_ar : a.neighborhood_en,
          isArabic ? b.neighborhood_ar : b.neighborhood_en
        )
      );
    } else {
      list.sort((a, b) => {
        const av = a.building_number ?? Number.MAX_SAFE_INTEGER;
        const bv = b.building_number ?? Number.MAX_SAFE_INTEGER;
        return av - bv;
      });
    }
    return list;
  }, [buildings, sort, isArabic]);

  const overallPct = totals ? vacancyPct(totals) : 0;

  function name(b: BuildingOccupancy) {
    return isArabic ? b.neighborhood_ar : b.neighborhood_en;
  }
  function city(b: BuildingOccupancy) {
    return isArabic ? b.city_ar : b.city_en;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {refreshedLabel && (
            <span className="text-xs text-gray-400 tabular-nums">
              {t('refresh.lastUpdated', { time: refreshedLabel })}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            aria-label={t('refresh.button')}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 bg-white hover:text-coral hover:border-coral/40 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : undefined} />
          </button>
          <label className="text-sm text-gray-600" htmlFor="occupancy-sort">
            {t('sortLabel')}
          </label>
          <select
            id="occupancy-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
          >
            <option value="most_empty">{t('sort.mostEmpty')}</option>
            <option value="name">{t('sort.name')}</option>
            <option value="building_number">{t('sort.buildingNumber')}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <SummarySkeleton />
      ) : error ? null : totals && sortedBuildings.length > 0 ? (
        <SummaryRow totals={totals} overallPct={overallPct} t={t} />
      ) : null}

      {!loading && !error && sortedBuildings.length > 0 && <Legend t={t} />}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={Activity}
            title={t('error.title')}
            description={t('error.description')}
            action={
              <button
                type="button"
                onClick={() => fetchData()}
                className="px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors"
              >
                {t('error.retry')}
              </button>
            }
          />
        </div>
      ) : sortedBuildings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={Activity}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedBuildings.map((b) => (
            <BuildingCard
              key={b.id}
              building={b}
              locale={locale}
              name={name(b)}
              city={city(b)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  totals,
  overallPct,
  t,
}: {
  totals: Totals;
  overallPct: number;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryStat label={t('summary.totalBeds')} value={intFmt.format(totals.total_beds)} />
        <SummaryStat
          label={t('summary.occupied')}
          value={intFmt.format(totals.occupied_beds)}
          accent="text-coral"
        />
        <SummaryStat
          label={t('summary.vacant')}
          value={intFmt.format(totals.vacant_beds)}
          accent="text-emerald-600"
        />
        <SummaryStat
          label={t('summary.vacancyPct')}
          value={`${pctFmt.format(overallPct)}%`}
        />
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ?? 'text-navy'}`}>{value}</p>
    </div>
  );
}

function Legend({ t }: { t: ReturnType<typeof useTranslations> }) {
  const items: { status: BedStatus; label: string }[] = [
    { status: 'vacant', label: t('legend.vacant') },
    { status: 'occupied', label: t('legend.occupied') },
    { status: 'maintenance', label: t('legend.maintenance') },
    { status: 'reserved', label: t('legend.reserved') },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
      <span className="font-medium text-gray-500">{t('legend.title')}</span>
      {items.map(({ status, label }) => {
        const Icon = STATUS_ICONS[status];
        return (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center justify-center w-4 h-4 rounded-sm text-white',
                STATUS_COLORS[status]
              )}
              aria-hidden
            >
              <Icon size={10} strokeWidth={2.5} />
            </span>
            <span>{label}</span>
          </span>
        );
      })}
    </div>
  );
}

function BuildingCard({
  building,
  locale,
  name,
  city,
  t,
}: {
  building: BuildingOccupancy;
  locale: string;
  name: string;
  city: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const pct = vacancyPct(building);

  return (
    <Link
      href={`/${locale}/admin/buildings/${building.id}#floorMap`}
      className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-coral/30 transition-all flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-navy group-hover:text-coral transition-colors truncate">
            {name}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{city}</p>
        </div>
        {building.building_number != null && (
          <span className="shrink-0 text-xs font-medium text-gray-400 tabular-nums">
            #{intFmt.format(building.building_number)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-baseline gap-1.5">
          <span className="text-xl font-semibold text-coral tabular-nums">
            {intFmt.format(building.occupied_beds)}
          </span>
          <span className="text-gray-500">
            {t('card.residents', { count: building.occupied_beds })}
          </span>
        </span>
        <span className="inline-flex items-baseline gap-1.5">
          <span className="text-xl font-semibold text-emerald-600 tabular-nums">
            {intFmt.format(building.vacant_beds)}
          </span>
          <span className="text-gray-500">
            {t('card.vacantBeds', { count: building.vacant_beds })}
          </span>
        </span>
        <span className="ms-auto text-xs font-medium text-gray-500 tabular-nums">
          {t('card.percentEmpty', { pct: pctFmt.format(pct) })}
        </span>
      </div>

      <SeatMap
        rooms={building.rooms}
        ariaLabel={t('card.heatmapAria', {
          name,
          vacant: building.vacant_beds,
          total: building.total_beds,
        })}
      />
    </Link>
  );
}

function SeatMap({
  rooms,
  ariaLabel,
}: {
  rooms: RoomOccupancy[];
  ariaLabel: string;
}) {
  const floors = useMemo(() => {
    const byFloor = new Map<number | 'none', RoomOccupancy[]>();
    for (const r of rooms) {
      const key = r.floor ?? 'none';
      const list = byFloor.get(key) ?? [];
      list.push(r);
      byFloor.set(key, list);
    }
    const keys = [...byFloor.keys()].sort((a, b) => {
      if (a === 'none' && b === 'none') return 0;
      if (a === 'none') return 1;
      if (b === 'none') return -1;
      return (b as number) - (a as number);
    });
    return keys.map((k) => ({ floor: k, rooms: byFloor.get(k)! }));
  }, [rooms]);

  if (rooms.length === 0) {
    return (
      <div
        className="border border-dashed border-gray-200 rounded-md py-4 text-center text-xs text-gray-400"
        role="img"
        aria-label={ariaLabel}
      >
        —
      </div>
    );
  }

  return (
    <div
      className="space-y-1.5 rounded-md bg-gray-50/60 p-2 border border-gray-100"
      role="img"
      aria-label={ariaLabel}
    >
      {floors.map(({ floor, rooms: floorRooms }) => (
        <div key={String(floor)} className="flex items-center gap-2">
          <span
            className={cn(
              'w-5 shrink-0 text-center text-[10px] font-semibold tabular-nums',
              'rounded-sm bg-white border border-gray-200 text-gray-500 py-0.5'
            )}
            aria-hidden
          >
            {floor === 'none' ? '·' : intFmt.format(floor)}
          </span>
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {floorRooms.map((room) => (
              <div
                key={room.id}
                className="inline-flex gap-px"
                title={room.room_number ?? undefined}
              >
                {room.bed_statuses.map((status, i) => {
                  const Icon = STATUS_ICONS[status];
                  // Occupied vs vacant share the Bed icon — distinguish them
                  // with reduced icon opacity on vacant tiles so the
                  // "filled" feel reads at a glance even in monochrome.
                  const iconOpacity =
                    status === 'vacant' ? 'opacity-60' : 'opacity-95';
                  return (
                    <span
                      key={i}
                      className={cn(
                        'inline-flex items-center justify-center w-4 h-4 rounded-[3px] text-white',
                        STATUS_COLORS[status]
                      )}
                    >
                      <Icon
                        size={9}
                        strokeWidth={2.5}
                        className={iconOpacity}
                        aria-hidden
                      />
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-7 w-16 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="space-y-2">
        <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="flex gap-4">
        <div className="h-6 w-20 bg-gray-100 rounded animate-pulse" />
        <div className="h-6 w-20 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="h-24 w-full bg-gray-100 rounded animate-pulse" />
    </div>
  );
}

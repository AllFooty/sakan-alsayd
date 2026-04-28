'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Building2,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  LayoutGrid,
  Rows3,
  ImageOff,
} from 'lucide-react';
import StatusBadge from '@/components/admin/shared/StatusBadge';
import EmptyState from '@/components/admin/shared/EmptyState';
import AdvancedFilters from '@/components/admin/shared/AdvancedFilters';
import { useAuth } from '@/lib/auth/hooks';
import { formatDate } from '@/lib/utils';

type SortColumn = 'city_en' | 'neighborhood_en' | 'sort_order' | 'created_at' | 'is_active';
type SortDir = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';

interface RoomStats {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
  reserved: number;
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
  is_active: boolean;
  is_placeholder: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  room_stats: RoomStats;
}

const VIEW_STORAGE_KEY = 'admin.buildings.view';

export default function BuildingsList() {
  const t = useTranslations('admin.buildings');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const { profile } = useAuth();
  const canCreate =
    !!profile &&
    (profile.role === 'super_admin' || profile.role === 'deputy_general_manager');

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('sort_order');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [view, setView] = useState<ViewMode>('grid');

  const limit = 24;

  // Hydrate view preference from localStorage on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'grid' || stored === 'table') setView(stored);
  }, []);

  function setViewPersist(next: ViewMode) {
    setView(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchBuildings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort: sortColumn,
        dir: sortDir,
      });
      if (cityFilter !== 'all') params.set('city', cityFilter);
      if (activeFilter !== 'all') params.set('is_active', activeFilter);
      if (searchDebounce) params.set('search', searchDebounce);

      const res = await fetch(`/api/admin/buildings?${params}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setBuildings(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setLoading(false);
    }
  }, [page, cityFilter, activeFilter, searchDebounce, sortColumn, sortDir, t]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  useEffect(() => {
    setPage(1);
  }, [cityFilter, activeFilter, searchDebounce, sortColumn, sortDir]);

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDir(column === 'created_at' ? 'desc' : 'asc');
    }
  }

  // Derive city options from the current page's buildings (covers the
  // common case — broader cities can be added once we have a dedicated
  // cities endpoint).
  const cityOptions = useMemo(() => {
    const seen = new Map<string, { en: string; ar: string }>();
    for (const b of buildings) {
      if (!seen.has(b.city_en)) {
        seen.set(b.city_en, { en: b.city_en, ar: b.city_ar });
      }
    }
    return Array.from(seen.values());
  }, [buildings]);

  const totalPages = Math.ceil(total / limit) || 1;
  const filtersActive = cityFilter !== 'all' || activeFilter !== 'all' || !!searchDebounce;

  function name(b: Building) {
    return isArabic ? b.neighborhood_ar : b.neighborhood_en;
  }
  function city(b: Building) {
    return isArabic ? b.city_ar : b.city_en;
  }
  function occupancyPct(stats: RoomStats) {
    if (stats.total === 0) return 0;
    return Math.round((stats.occupied / stats.total) * 100);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setViewPersist} t={t} />
          {canCreate && (
            <Link
              href={`/${locale}/admin/buildings/new`}
              className="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
            >
              <Plus size={16} />
              {t('addButton')}
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('filters.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
          />
        </div>
      </div>

      <AdvancedFilters
        fields={[
          {
            key: 'city',
            label: t('filters.city'),
            type: 'select',
            options: [
              { value: 'all', label: t('filters.allCities') },
              ...cityOptions.map((c) => ({
                value: c.en,
                label: isArabic ? c.ar : c.en,
              })),
            ],
          },
          {
            key: 'is_active',
            label: t('filters.status'),
            type: 'select',
            options: [
              { value: 'all', label: t('filters.allStatuses') },
              { value: 'true', label: t('filters.active') },
              { value: 'false', label: t('filters.inactive') },
            ],
          },
        ]}
        values={{ city: cityFilter, is_active: activeFilter }}
        onChange={(key, value) => {
          if (key === 'city') setCityFilter(value);
          if (key === 'is_active') setActiveFilter(value);
        }}
        onClear={() => {
          setCityFilter('all');
          setActiveFilter('all');
        }}
        activeCount={[cityFilter !== 'all', activeFilter !== 'all'].filter(Boolean).length}
        filterLabel={t('filters.advancedFilters')}
        clearLabel={t('filters.clearFilters')}
      />

      {/* Body */}
      {loading ? (
        view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <div className="aspect-[4/3] bg-gray-100 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        )
      ) : buildings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={Building2}
            title={filtersActive ? t('empty.filteredTitle') : t('empty.title')}
            description={
              filtersActive ? t('empty.filteredDescription') : t('empty.description')
            }
          />
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {buildings.map((b) => (
            <Link
              key={b.id}
              href={`/${locale}/admin/buildings/${b.id}`}
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-coral/30 transition-all"
            >
              <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                {b.cover_image ? (
                  <Image
                    src={b.cover_image}
                    alt={name(b)}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                    <ImageOff size={32} />
                    <span className="text-xs mt-2">{t('card.noPhoto')}</span>
                  </div>
                )}
                <div className="absolute top-2 end-2 flex gap-1">
                  {!b.is_active && (
                    <StatusBadge label={t('status.inactive')} variant="neutral" />
                  )}
                  {b.is_placeholder && (
                    <StatusBadge label={t('status.placeholder')} variant="warning" />
                  )}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-navy group-hover:text-coral transition-colors">
                  {name(b)}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">{city(b)}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-600">
                  <span>{t('card.totalRooms', { count: b.room_stats.total })}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-emerald-600">
                    {t('card.available', { count: b.room_stats.available })}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-coral">
                    {t('card.occupied', { count: b.room_stats.occupied })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <SortableHeader
                    label={t('table.city')}
                    column="city_en"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label={t('table.neighborhood')}
                    column="neighborhood_en"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                    {t('table.rooms')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">
                    {t('table.occupancy')}
                  </th>
                  <SortableHeader
                    label={t('table.status')}
                    column="is_active"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label={t('table.updatedAt')}
                    column="created_at"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="hidden xl:table-cell"
                  />
                </tr>
              </thead>
              <tbody>
                {buildings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-700">{city(b)}</td>
                    <td className="px-4 py-3 font-medium text-navy">
                      <Link
                        href={`/${locale}/admin/buildings/${b.id}`}
                        className="hover:text-coral transition-colors"
                      >
                        {name(b)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {b.room_stats.total}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <OccupancyBar
                        occupied={b.room_stats.occupied}
                        total={b.room_stats.total}
                        pct={occupancyPct(b.room_stats)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={b.is_active ? t('status.active') : t('status.inactive')}
                        variant={b.is_active ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">
                      {formatDate(b.updated_at, isArabic ? 'ar' : 'en')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              summary={t('pagination.summary', { count: total })}
            />
          )}
        </div>
      )}

      {view === 'grid' && totalPages > 1 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            summary={t('pagination.summary', { count: total })}
          />
        </div>
      )}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
  t,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange('grid')}
        aria-pressed={view === 'grid'}
        title={t('view.grid')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
          view === 'grid' ? 'bg-navy text-white' : 'text-gray-600 hover:text-navy'
        }`}
      >
        <LayoutGrid size={14} />
        <span className="hidden sm:inline">{t('view.grid')}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        aria-pressed={view === 'table'}
        title={t('view.table')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
          view === 'table' ? 'bg-navy text-white' : 'text-gray-600 hover:text-navy'
        }`}
      >
        <Rows3 size={14} />
        <span className="hidden sm:inline">{t('view.table')}</span>
      </button>
    </div>
  );
}

function OccupancyBar({
  occupied,
  total,
  pct,
}: {
  occupied: number;
  total: number;
  pct: number;
}) {
  if (total === 0) {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  return (
    <div className="flex items-center gap-2 min-w-[6rem]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-coral transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 tabular-nums whitespace-nowrap">
        {occupied}/{total}
      </span>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
  summary,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  summary: string;
}) {
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const PrevIcon = isArabic ? ChevronRight : ChevronLeft;
  const NextIcon = isArabic ? ChevronLeft : ChevronRight;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
      <p className="text-sm text-gray-500">{summary}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={tCommon('pagination.previous')}
        >
          <PrevIcon size={16} />
        </button>
        <span className="text-sm text-gray-600 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          onClick={onNext}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={tCommon('pagination.next')}
        >
          <NextIcon size={16} />
        </button>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  column,
  sortColumn,
  sortDir,
  onSort,
  className = '',
}: {
  label: string;
  column: SortColumn;
  sortColumn: SortColumn;
  sortDir: SortDir;
  onSort: (column: SortColumn) => void;
  className?: string;
}) {
  const active = sortColumn === column;
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      className={`text-start px-4 py-3 font-medium text-gray-500 ${className}`}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`flex items-center gap-1.5 hover:text-navy transition-colors ${
          active ? 'text-navy' : ''
        }`}
      >
        <span>{label}</span>
        <Icon size={14} className={active ? 'opacity-100' : 'opacity-40'} />
      </button>
    </th>
  );
}

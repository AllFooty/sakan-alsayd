'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  LayoutGrid,
  Rows3,
} from 'lucide-react';
import StatusBadge from '@/components/admin/shared/StatusBadge';
import EmptyState from '@/components/admin/shared/EmptyState';
import AdvancedFilters from '@/components/admin/shared/AdvancedFilters';
import { useAuth } from '@/lib/auth/hooks';
import { formatDate } from '@/lib/utils';
import type { ResidentListItem, ResidentStatus } from '@/lib/residents/types';

type SortColumn = 'full_name' | 'created_at' | 'updated_at' | 'status';
type SortDir = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';

const VIEW_STORAGE_KEY = 'admin.residents.view';

interface ResidentsResponse {
  data: ResidentListItem[];
  total: number;
  page: number;
  limit: number;
}

export default function ResidentsList() {
  const t = useTranslations('admin.residents');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const { profile } = useAuth();
  const canCreate =
    !!profile &&
    (profile.role === 'super_admin' ||
      profile.role === 'deputy_general_manager' ||
      profile.role === 'branch_manager' ||
      profile.role === 'supervision_staff');

  const [residents, setResidents] = useState<ResidentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [nationalityFilter, setNationalityFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
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

  const fetchResidents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort: sortColumn,
        dir: sortDir,
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (buildingFilter !== 'all') params.set('building_id', buildingFilter);
      if (nationalityFilter !== 'all') params.set('nationality', nationalityFilter);
      if (searchDebounce) params.set('search', searchDebounce);

      const res = await fetch(`/api/admin/residents?${params}`);
      if (!res.ok) throw new Error('Failed');
      const json = (await res.json()) as ResidentsResponse;
      setResidents(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      console.error('Failed to fetch residents:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, buildingFilter, nationalityFilter, searchDebounce, sortColumn, sortDir, t]);

  useEffect(() => {
    fetchResidents();
  }, [fetchResidents]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, buildingFilter, nationalityFilter, searchDebounce, sortColumn, sortDir]);

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDir(column === 'created_at' ? 'desc' : 'asc');
    }
  }

  // Derive building options from currently visible residents whose current
  // assignment is set. Cities/neighborhoods come from the joined building
  // payload — see ResidentListItem.current_assignment.
  const buildingOptions = useMemo(() => {
    const seen = new Map<string, { id: string; en: string; ar: string }>();
    for (const r of residents) {
      const a = r.current_assignment;
      if (!a) continue;
      if (!seen.has(a.building_id)) {
        seen.set(a.building_id, {
          id: a.building_id,
          en: a.building_neighborhood_en,
          ar: a.building_neighborhood_ar,
        });
      }
    }
    return Array.from(seen.values());
  }, [residents]);

  const nationalityOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of residents) {
      if (r.nationality) seen.add(r.nationality);
    }
    return Array.from(seen.values());
  }, [residents]);

  const totalPages = Math.ceil(total / limit) || 1;
  const filtersActive =
    statusFilter !== 'all' ||
    buildingFilter !== 'all' ||
    nationalityFilter !== 'all' ||
    !!searchDebounce;

  function neighborhood(a: NonNullable<ResidentListItem['current_assignment']>) {
    return isArabic ? a.building_neighborhood_ar : a.building_neighborhood_en;
  }

  function statusVariant(status: ResidentStatus): 'success' | 'neutral' | 'warning' {
    switch (status) {
      case 'active':
        return 'success';
      case 'checked_out':
        return 'neutral';
      case 'suspended':
        return 'warning';
    }
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
              href={`/${locale}/admin/residents/new`}
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
            key: 'status',
            label: t('filters.status'),
            type: 'select',
            options: [
              { value: 'all', label: t('filters.allStatuses') },
              { value: 'active', label: t('status.active') },
              { value: 'checked_out', label: t('status.checked_out') },
              { value: 'suspended', label: t('status.suspended') },
            ],
          },
          {
            key: 'building_id',
            label: t('filters.building'),
            type: 'select',
            options: [
              { value: 'all', label: t('filters.allBuildings') },
              ...buildingOptions.map((b) => ({
                value: b.id,
                label: isArabic ? b.ar : b.en,
              })),
            ],
          },
          {
            key: 'nationality',
            label: t('filters.nationality'),
            type: 'select',
            options: [
              { value: 'all', label: t('filters.allNationalities') },
              ...nationalityOptions.map((n) => ({ value: n, label: n })),
            ],
          },
        ]}
        values={{
          status: statusFilter,
          building_id: buildingFilter,
          nationality: nationalityFilter,
        }}
        onChange={(key, value) => {
          if (key === 'status') setStatusFilter(value);
          if (key === 'building_id') setBuildingFilter(value);
          if (key === 'nationality') setNationalityFilter(value);
        }}
        onClear={() => {
          setStatusFilter('all');
          setBuildingFilter('all');
          setNationalityFilter('all');
        }}
        activeCount={
          [
            statusFilter !== 'all',
            buildingFilter !== 'all',
            nationalityFilter !== 'all',
          ].filter(Boolean).length
        }
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
                <div className="aspect-square bg-gray-100 animate-pulse" />
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
      ) : residents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={Users}
            title={filtersActive ? t('empty.filteredTitle') : t('empty.title')}
            description={
              filtersActive ? t('empty.filteredDescription') : t('empty.description')
            }
          />
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {residents.map((r) => (
            <Link
              key={r.id}
              href={`/${locale}/admin/residents/${r.id}`}
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-coral/30 transition-all"
            >
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {r.profile_image ? (
                  <Image
                    src={r.profile_image}
                    alt={r.full_name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                    <Users size={36} />
                    <span className="text-xs mt-2">{t('card.noPhoto')}</span>
                  </div>
                )}
                {r.status !== 'active' && (
                  <div className="absolute top-2 end-2 flex gap-1">
                    <StatusBadge
                      label={t(`status.${r.status}`)}
                      variant={statusVariant(r.status)}
                    />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-navy group-hover:text-coral transition-colors truncate">
                  {r.full_name}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5 truncate">
                  {r.nationality ?? t('card.nationalityUnknown')}
                </p>
                <div className="mt-3 text-xs text-gray-600 truncate">
                  {r.current_assignment ? (
                    <>
                      <span>
                        {t('card.roomLabel', {
                          number: r.current_assignment.room_number ?? '?',
                        })}
                      </span>
                      <span className="text-gray-300 mx-1.5">·</span>
                      <span>{neighborhood(r.current_assignment)}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">{t('card.notAssigned')}</span>
                  )}
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
                    label={t('table.name')}
                    column="full_name"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                    {t('table.phone')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">
                    {t('table.nationality')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                    {t('table.building')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">
                    {t('table.room')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">
                    {t('table.checkIn')}
                  </th>
                  <SortableHeader
                    label={t('table.status')}
                    column="status"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label={t('table.updatedAt')}
                    column="updated_at"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="hidden xl:table-cell"
                  />
                </tr>
              </thead>
              <tbody>
                {residents.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-navy">
                      <Link
                        href={`/${locale}/admin/residents/${r.id}`}
                        className="hover:text-coral transition-colors"
                      >
                        {r.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell tabular-nums">
                      {r.phone}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {r.nationality ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {r.current_assignment ? (
                        neighborhood(r.current_assignment)
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell tabular-nums">
                      {r.current_assignment?.room_number ?? (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">
                      {r.current_assignment ? (
                        formatDate(r.current_assignment.check_in_date, isArabic ? 'ar' : 'en')
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={t(`status.${r.status}`)}
                        variant={statusVariant(r.status)}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">
                      {formatDate(r.updated_at, isArabic ? 'ar' : 'en')}
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

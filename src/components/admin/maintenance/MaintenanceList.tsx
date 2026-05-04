'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Plus,
  Download,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import StatusBadge, {
  getMaintenanceStatusVariant,
  getMaintenancePriorityVariant,
} from '@/components/admin/shared/StatusBadge';
import EmptyState from '@/components/admin/shared/EmptyState';
import SortableHeader, { type SortDirection } from '@/components/admin/shared/SortableHeader';
import BulkActionBar from '@/components/admin/shared/BulkActionBar';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';
import AdvancedFilters from '@/components/admin/shared/AdvancedFilters';
import { generateCsv, downloadCsv } from '@/lib/export';

const MaintenanceModal = dynamic(
  () => import('@/components/ui/MaintenanceModal'),
  { ssr: false }
);

interface MaintenanceRequest {
  id: string;
  description: string | null;
  extra_details: string | null;
  category: string;
  priority: string;
  status: string;
  requester_name: string | null;
  requester_phone: string | null;
  room_number: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  building: {
    id: string;
    slug: string;
    neighborhood_en: string;
    neighborhood_ar: string;
    city_en: string;
    city_ar: string;
  } | null;
  assigned_staff: { id: string; full_name: string } | null;
}

const STATUSES = ['all', 'submitted', 'assigned', 'in_progress', 'completed', 'rejected', 'cancelled'] as const;
const MAINTENANCE_STATUS_OPTIONS = ['submitted', 'assigned', 'in_progress', 'completed', 'rejected', 'cancelled'] as const;
const PRIORITIES = ['all', 'low', 'medium', 'high', 'urgent'] as const;
const CATEGORIES = ['all', 'plumbing', 'electrical', 'furniture', 'hvac', 'general'] as const;

// Module-level caches so filter data survives language switches and page navigation
let cachedStaffList: { id: string; full_name: string }[] | null = null;
let cachedBuildingsList: { id: string; slug: string; neighborhood_en: string; neighborhood_ar: string; city_en: string; city_ar: string }[] | null = null;

export default function MaintenanceList() {
  const t = useTranslations('admin.maintenance');
  const tb = useTranslations('admin.bulk');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const PrevIcon = isArabic ? ChevronRight : ChevronLeft;
  const NextIcon = isArabic ? ChevronLeft : ChevronRight;
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsHook = useSearchParams();

  const SORTABLE_FIELDS = ['created_at', 'priority', 'status'] as const;
  const initialSortRaw = searchParamsHook?.get('sort') ?? null;
  const initialSort = (SORTABLE_FIELDS as readonly string[]).includes(initialSortRaw ?? '')
    ? (initialSortRaw as (typeof SORTABLE_FIELDS)[number])
    : 'created_at';
  const initialDir: SortDirection = searchParamsHook?.get('dir') === 'asc' ? 'asc' : 'desc';

  const [sortField, setSortField] = useState<(typeof SORTABLE_FIELDS)[number]>(initialSort);
  const [sortDir, setSortDir] = useState<SortDirection>(initialDir);

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [showNewMaintenance, setShowNewMaintenance] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [pendingBulkStatus, setPendingBulkStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [assignedToFilter, setAssignedToFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [apartmentSharedFilter, setApartmentSharedFilter] = useState<boolean>(false);
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>(cachedStaffList || []);
  const [buildingsList, setBuildingsList] = useState<{ id: string; slug: string; neighborhood_en: string; neighborhood_ar: string; city_en: string; city_ar: string }[]>(cachedBuildingsList || []);

  const limit = 20;

  // Fetch staff and buildings for filters — skip if already cached
  useEffect(() => {
    if (!cachedStaffList) {
      fetch('/api/maintenance-requests/staff')
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          cachedStaffList = list;
          setStaffList(list);
        })
        .catch(() => {});
    }
    if (!cachedBuildingsList) {
      fetch('/api/buildings')
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          cachedBuildingsList = list;
          setBuildingsList(list);
        })
        .catch(() => {});
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (searchDebounce) params.set('search', searchDebounce);
      if (buildingFilter !== 'all') params.set('building_id', buildingFilter);
      if (assignedToFilter !== 'all') params.set('assigned_to', assignedToFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (apartmentSharedFilter) params.set('apartment_shared', '1');
      if (sortField !== 'created_at' || sortDir !== 'desc') {
        params.set('sort', sortField);
        params.set('dir', sortDir);
      }

      const res = await fetch(`/api/maintenance-requests?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setRequests(json.data || []);
      setTotal(json.total || 0);
    } catch (error) {
      console.error('Failed to fetch maintenance requests:', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter, categoryFilter, searchDebounce, buildingFilter, assignedToFilter, dateFrom, dateTo, apartmentSharedFilter, sortField, sortDir]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Reset page and clear selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusFilter, priorityFilter, categoryFilter, searchDebounce, buildingFilter, assignedToFilter, dateFrom, dateTo, apartmentSharedFilter, sortField, sortDir]);

  // Mirror sort state into the URL.
  useEffect(() => {
    if (!pathname) return;
    const params = new URLSearchParams(searchParamsHook?.toString() || '');
    if (sortField === 'created_at' && sortDir === 'desc') {
      params.delete('sort');
      params.delete('dir');
    } else {
      params.set('sort', sortField);
      params.set('dir', sortDir);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDir]);

  const handleSort = (field: string) => {
    if (!(SORTABLE_FIELDS as readonly string[]).includes(field)) return;
    const f = field as (typeof SORTABLE_FIELDS)[number];
    if (f === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(f);
      setSortDir('desc');
    }
  };

  // Clear selection when page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const toggleSelectAll = () => {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkStatusChange = (status: string) => {
    if (selectedIds.size === 0) return;
    setPendingBulkStatus(status);
  };

  const confirmBulkStatusChange = async () => {
    const status = pendingBulkStatus;
    if (!status || selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/maintenance-requests/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        fetchRequests();
      }
    } catch (error) {
      console.error('Bulk status change failed:', error);
    } finally {
      setBulkLoading(false);
      setPendingBulkStatus(null);
    }
  };


  const totalPages = Math.ceil(total / limit);

  const formatDateLocal = (dateStr: string) => formatDate(dateStr, isArabic ? 'ar' : 'en');

  const getBuildingName = (req: MaintenanceRequest) => {
    if (!req.building) return '—';
    return isArabic ? req.building.neighborhood_ar : req.building.neighborhood_en;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ export: 'true' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (searchDebounce) params.set('search', searchDebounce);
      if (buildingFilter !== 'all') params.set('building_id', buildingFilter);
      if (assignedToFilter !== 'all') params.set('assigned_to', assignedToFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (apartmentSharedFilter) params.set('apartment_shared', '1');

      const res = await fetch(`/api/maintenance-requests?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const rows = (json.data || []).map((r: MaintenanceRequest) => ({
        summary: r.description || '',
        extraDetails: r.extra_details || '',
        building: getBuildingName(r),
        category: t(`category.${r.category}`),
        priority: t(`priority.${r.priority}`),
        status: t(`status.${r.status}`),
        assignedTo: r.assigned_staff?.full_name || '',
        requester: r.requester_name || '',
        phone: r.requester_phone || '',
        date: new Date(r.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }),
      }));
      const columns = [
        { key: 'summary', header: t('table.summary') },
        { key: 'extraDetails', header: t('table.extraDetails') },
        { key: 'building', header: t('table.building') },
        { key: 'category', header: t('table.category') },
        { key: 'priority', header: t('table.priority') },
        { key: 'status', header: t('table.status') },
        { key: 'assignedTo', header: t('table.assignedTo') },
        { key: 'requester', header: t('table.requester') },
        { key: 'phone', header: t('table.phone') },
        { key: 'date', header: t('table.date') },
      ];
      const csv = generateCsv(rows, columns);
      const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(/\//g, '-');
      downloadCsv(csv, `maintenance-${dateStr}.csv`);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with New Request and Export buttons */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-[var(--admin-border)] text-gray-700 dark:text-[var(--admin-text-muted)] text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-[var(--admin-surface-2)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={16} />
          {exporting ? t('exporting') : t('export')}
        </button>
        <button
          onClick={() => setShowNewMaintenance(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
        >
          <Plus size={16} />
          {t('newRequest')}
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-lg p-1 overflow-x-auto">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              statusFilter === s
                ? 'bg-white dark:bg-[var(--admin-surface)] text-navy dark:text-[var(--admin-text)] shadow-sm'
                : 'text-gray-500 dark:text-[var(--admin-text-muted)] hover:text-gray-700 dark:hover:text-[var(--admin-text)]'
            }`}
          >
            {t(`filters.${s}`)}
          </button>
        ))}
      </div>

      {/* Search + apartment-shared toggle */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[var(--admin-text-subtle)]"
          />
          <input
            type="text"
            placeholder={t('filters.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2 border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] text-navy dark:text-[var(--admin-text)] placeholder:text-gray-400 dark:placeholder:text-[var(--admin-text-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
          />
        </div>
        <button
          type="button"
          onClick={() => setApartmentSharedFilter((v) => !v)}
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
            apartmentSharedFilter
              ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
              : 'border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] text-gray-600 dark:text-[var(--admin-text-muted)] hover:border-amber-300 dark:hover:border-amber-500/40 hover:text-amber-700 dark:hover:text-amber-300'
          }`}
          title={t('filters.apartmentSharedHelper')}
        >
          {t('filters.apartmentShared')}
        </button>
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        fields={[
          {
            key: 'priority',
            label: t('filters.allPriorities'),
            type: 'select',
            options: PRIORITIES.map((p) => ({
              value: p,
              label: p === 'all' ? t('filters.allPriorities') : t(`priority.${p}`),
            })),
          },
          {
            key: 'category',
            label: t('filters.allCategories'),
            type: 'select',
            options: CATEGORIES.map((c) => ({
              value: c,
              label: c === 'all' ? t('filters.allCategories') : t(`category.${c}`),
            })),
          },
          {
            key: 'building_id',
            label: t('filters.building'),
            type: 'select',
            options: [
              { value: 'all', label: t('filters.allBuildings') },
              ...buildingsList.map((b) => ({
                value: b.id,
                label: isArabic
                  ? `${b.neighborhood_ar} - ${b.city_ar}`
                  : `${b.neighborhood_en} - ${b.city_en}`,
              })),
            ],
          },
          {
            key: 'assigned_to',
            label: t('filters.assignedTo'),
            type: 'select',
            options: [
              { value: 'all', label: t('filters.allStaff') },
              ...staffList.map((s) => ({ value: s.id, label: s.full_name })),
            ],
          },
          { key: 'date_from', label: t('filters.dateFrom'), type: 'date' },
          { key: 'date_to', label: t('filters.dateTo'), type: 'date' },
        ]}
        values={{
          priority: priorityFilter,
          category: categoryFilter,
          building_id: buildingFilter,
          assigned_to: assignedToFilter,
          date_from: dateFrom,
          date_to: dateTo,
        }}
        onChange={(key, value) => {
          if (key === 'priority') setPriorityFilter(value);
          if (key === 'category') setCategoryFilter(value);
          if (key === 'building_id') setBuildingFilter(value);
          if (key === 'assigned_to') setAssignedToFilter(value);
          if (key === 'date_from') setDateFrom(value);
          if (key === 'date_to') setDateTo(value);
        }}
        onClear={() => {
          setPriorityFilter('all');
          setCategoryFilter('all');
          setBuildingFilter('all');
          setAssignedToFilter('all');
          setDateFrom('');
          setDateTo('');
          setApartmentSharedFilter(false);
        }}
        activeCount={
          [
            priorityFilter !== 'all',
            categoryFilter !== 'all',
            buildingFilter !== 'all',
            assignedToFilter !== 'all',
            !!dateFrom,
            !!dateTo,
            apartmentSharedFilter,
          ].filter(Boolean).length
        }
        filterLabel={t('filters.advancedFilters')}
        clearLabel={t('filters.clearFilters')}
      />

      {/* Table */}
      {loading ? (
        <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)]">
          <EmptyState
            icon={Wrench}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[var(--admin-border)] bg-gray-50 dark:bg-[var(--admin-surface-2)]">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={requests.length > 0 && selectedIds.size === requests.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 dark:border-[var(--admin-border)] text-coral focus:ring-coral/50"
                    />
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 dark:text-[var(--admin-text-muted)]">
                    {t('table.summary')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 dark:text-[var(--admin-text-muted)] hidden md:table-cell">
                    {t('table.building')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 dark:text-[var(--admin-text-muted)] hidden lg:table-cell">
                    {t('table.category')}
                  </th>
                  <SortableHeader
                    field="priority"
                    activeField={sortField}
                    direction={sortDir}
                    onSort={handleSort}
                  >
                    {t('table.priority')}
                  </SortableHeader>
                  <SortableHeader
                    field="status"
                    activeField={sortField}
                    direction={sortDir}
                    onSort={handleSort}
                  >
                    {t('table.status')}
                  </SortableHeader>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 dark:text-[var(--admin-text-muted)] hidden xl:table-cell">
                    {t('table.assignedTo')}
                  </th>
                  <SortableHeader
                    field="created_at"
                    activeField={sortField}
                    direction={sortDir}
                    onSort={handleSort}
                    className="hidden sm:table-cell"
                  >
                    {t('table.date')}
                  </SortableHeader>
                  <th className="text-end px-4 py-3 font-medium text-gray-500 dark:text-[var(--admin-text-muted)]">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr
                    key={req.id}
                    className={`border-b border-gray-100 dark:border-[var(--admin-border)] hover:bg-gray-50 dark:hover:bg-[var(--admin-surface-2)] cursor-pointer transition-colors ${selectedIds.has(req.id) ? 'bg-coral/5 dark:bg-coral/10' : ''}`}
                    onClick={() => router.push(`maintenance/${req.id}`)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(req.id)}
                        onChange={() => toggleSelect(req.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 dark:border-[var(--admin-border)] text-coral focus:ring-coral/50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <p className="font-medium text-navy dark:text-[var(--admin-text)] line-clamp-2">
                          {req.description || <span className="text-gray-400 dark:text-[var(--admin-text-subtle)] font-normal">—</span>}
                        </p>
                        {req.requester_name && (
                          <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{req.requester_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-[var(--admin-text-muted)] hidden md:table-cell">
                      {getBuildingName(req)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-gray-600 dark:text-[var(--admin-text-muted)]">{t(`category.${req.category}`)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={t(`priority.${req.priority}`)}
                        variant={getMaintenancePriorityVariant(req.priority)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={t(`status.${req.status}`)}
                        variant={getMaintenanceStatusVariant(req.status)}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-[var(--admin-text-muted)] hidden xl:table-cell">
                      {req.assigned_staff?.full_name || (
                        <span className="text-gray-400 dark:text-[var(--admin-text-subtle)]">{t('table.unassigned')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-[var(--admin-text-muted)] hidden sm:table-cell">
                      {formatDateLocal(req.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`maintenance/${req.id}`);
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[var(--admin-surface-2)] text-gray-500 dark:text-[var(--admin-text-muted)] hover:text-navy dark:hover:text-[var(--admin-text)] transition-colors"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-[var(--admin-border)]">
              <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">
                {total} {t('title').toLowerCase()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[var(--admin-surface-2)] text-gray-600 dark:text-[var(--admin-text-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={tCommon('pagination.previous')}
                >
                  <PrevIcon size={16} />
                </button>
                <span className="text-sm text-gray-600 dark:text-[var(--admin-text-muted)]">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[var(--admin-surface-2)] text-gray-600 dark:text-[var(--admin-text-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={tCommon('pagination.next')}
                >
                  <NextIcon size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onChangeStatus={handleBulkStatusChange}
        onClear={() => setSelectedIds(new Set())}
        statusOptions={MAINTENANCE_STATUS_OPTIONS.map((s) => ({
          value: s,
          label: t(`status.${s}`),
        }))}
        loading={bulkLoading}
      />

      <ConfirmDialog
        isOpen={pendingBulkStatus !== null}
        onClose={() => setPendingBulkStatus(null)}
        onConfirm={confirmBulkStatusChange}
        title={tb('confirmStatusChange.title')}
        description={tb('confirmStatusChange.maintenanceDescription', {
          count: selectedIds.size,
          status: pendingBulkStatus ? t(`status.${pendingBulkStatus}`) : '',
        })}
        confirmLabel={tb('confirmStatusChange.confirm')}
        cancelLabel={tb('confirmStatusChange.cancel')}
        variant="warning"
        loading={bulkLoading}
      />

      {showNewMaintenance && (
        <MaintenanceModal
          isOpen
          onClose={() => {
            setShowNewMaintenance(false);
            fetchRequests();
          }}
        />
      )}
    </div>
  );
}

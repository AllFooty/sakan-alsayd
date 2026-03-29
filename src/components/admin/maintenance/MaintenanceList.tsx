'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Plus,
  Download,
} from 'lucide-react';
import StatusBadge, {
  getMaintenanceStatusVariant,
  getMaintenancePriorityVariant,
} from '@/components/admin/shared/StatusBadge';
import EmptyState from '@/components/admin/shared/EmptyState';
import BulkActionBar from '@/components/admin/shared/BulkActionBar';
import MaintenanceModal from '@/components/ui/MaintenanceModal';
import AdvancedFilters from '@/components/admin/shared/AdvancedFilters';
import { generateCsv, downloadCsv } from '@/lib/export';

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string | null;
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
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();

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
  const [exporting, setExporting] = useState(false);
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [assignedToFilter, setAssignedToFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
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
  }, [page, statusFilter, priorityFilter, categoryFilter, searchDebounce, buildingFilter, assignedToFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Reset page and clear selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusFilter, priorityFilter, categoryFilter, searchDebounce, buildingFilter, assignedToFilter, dateFrom, dateTo]);

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

  const handleBulkStatusChange = async (status: string) => {
    if (selectedIds.size === 0) return;
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
    }
  };


  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isArabic ? 'ar-SA-u-nu-latn' : 'en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

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

      const res = await fetch(`/api/maintenance-requests?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const rows = (json.data || []).map((r: MaintenanceRequest) => ({
        title: r.title,
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
        { key: 'title', header: t('table.title') },
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
          className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              statusFilter === s
                ? 'bg-white text-navy shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(`filters.${s}`)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder={t('filters.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full ps-10 pe-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
        />
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
        }}
        activeCount={
          [
            priorityFilter !== 'all',
            categoryFilter !== 'all',
            buildingFilter !== 'all',
            assignedToFilter !== 'all',
            !!dateFrom,
            !!dateTo,
          ].filter(Boolean).length
        }
        filterLabel={t('filters.advancedFilters')}
        clearLabel={t('filters.clearFilters')}
      />

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={Wrench}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={requests.length > 0 && selectedIds.size === requests.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-coral focus:ring-coral/50"
                    />
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500">
                    {t('table.title')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                    {t('table.building')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">
                    {t('table.category')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500">
                    {t('table.priority')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500">
                    {t('table.status')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden xl:table-cell">
                    {t('table.assignedTo')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">
                    {t('table.date')}
                  </th>
                  <th className="text-end px-4 py-3 font-medium text-gray-500">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr
                    key={req.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(req.id) ? 'bg-coral/5' : ''}`}
                    onClick={() => router.push(`maintenance/${req.id}`)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(req.id)}
                        onChange={() => toggleSelect(req.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 text-coral focus:ring-coral/50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-navy">{req.title}</p>
                        {req.requester_name && (
                          <p className="text-xs text-gray-500">{req.requester_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {getBuildingName(req)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-gray-600">{t(`category.${req.category}`)}</span>
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
                    <td className="px-4 py-3 text-gray-600 hidden xl:table-cell">
                      {req.assigned_staff?.full_name || (
                        <span className="text-gray-400">{t('table.unassigned')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                      {formatDate(req.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`maintenance/${req.id}`);
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-navy transition-colors"
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                {total} {t('title').toLowerCase()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
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

      <MaintenanceModal
        isOpen={showNewMaintenance}
        onClose={() => {
          setShowNewMaintenance(false);
          fetchRequests();
        }}
      />
    </div>
  );
}

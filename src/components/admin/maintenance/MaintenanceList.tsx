'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Search,
  Eye,
  Trash2,
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
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';
import BulkActionBar from '@/components/admin/shared/BulkActionBar';
import MaintenanceModal from '@/components/ui/MaintenanceModal';
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

const STATUSES = ['all', 'submitted', 'assigned', 'in_progress', 'completed', 'cancelled'] as const;
const MAINTENANCE_STATUS_OPTIONS = ['submitted', 'assigned', 'in_progress', 'completed', 'cancelled'] as const;
const PRIORITIES = ['all', 'low', 'medium', 'high', 'urgent'] as const;
const CATEGORIES = ['all', 'plumbing', 'electrical', 'furniture', 'cleaning', 'hvac', 'general'] as const;

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
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNewMaintenance, setShowNewMaintenance] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  const limit = 20;

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
  }, [page, statusFilter, priorityFilter, categoryFilter, searchDebounce]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Reset page and clear selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusFilter, priorityFilter, categoryFilter, searchDebounce]);

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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/maintenance-requests/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        setBulkDeleteConfirm(false);
        fetchRequests();
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/maintenance-requests/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchRequests();
      }
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
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

      const res = await fetch(`/api/maintenance-requests?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const rows = (json.data || []).map((r: MaintenanceRequest) => ({
        title: r.title,
        building: getBuildingName(r),
        category: r.category,
        priority: r.priority,
        status: r.status,
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

      {/* Secondary filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p === 'all' ? t('filters.allPriorities') : t(`priority.${p}`)}
            </option>
          ))}
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? t('filters.allCategories') : t(`category.${c}`)}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-0">
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
      </div>

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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(req);
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
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

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('deleteConfirm.title')}
        description={t('deleteConfirm.description')}
        confirmLabel={t('deleteConfirm.confirm')}
        cancelLabel={t('deleteConfirm.cancel')}
        variant="danger"
        loading={deleting}
      />

      {/* Bulk delete confirmation */}
      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title={t('deleteConfirm.title')}
        description={tb('confirmDelete', { count: selectedIds.size })}
        confirmLabel={t('deleteConfirm.confirm')}
        cancelLabel={t('deleteConfirm.cancel')}
        variant="danger"
        loading={bulkLoading}
      />

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onChangeStatus={handleBulkStatusChange}
        onDelete={() => setBulkDeleteConfirm(true)}
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

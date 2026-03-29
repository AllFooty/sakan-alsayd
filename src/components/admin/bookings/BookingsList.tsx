'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Download,
} from 'lucide-react';
import StatusBadge, { getBookingStatusVariant } from '@/components/admin/shared/StatusBadge';
import EmptyState from '@/components/admin/shared/EmptyState';
import BulkActionBar from '@/components/admin/shared/BulkActionBar';
import BookingModal from '@/components/ui/BookingModal';
import AdvancedFilters from '@/components/admin/shared/AdvancedFilters';
import { generateCsv, downloadCsv } from '@/lib/export';

interface BookingRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  city_interested: string;
  message: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assigned_staff: { id: string; full_name: string } | null;
}

const STATUSES = ['all', 'new', 'in_review', 'pending_payment', 'pending_onboarding', 'completed', 'rejected', 'cancelled'] as const;

const BOOKING_STATUS_OPTIONS = ['new', 'in_review', 'pending_payment', 'pending_onboarding', 'completed', 'rejected', 'cancelled'] as const;

const CITIES = [
  { value: 'Khobar', en: 'Khobar', ar: 'الخبر' },
  { value: 'Dammam', en: 'Dammam', ar: 'الدمام' },
  { value: 'Jubail', en: 'Jubail', ar: 'الجبيل' },
  { value: 'Riyadh', en: 'Riyadh', ar: 'الرياض' },
];

export default function BookingsList() {
  const t = useTranslations('admin.bookings');
  const tb = useTranslations('admin.bulk');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();

  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [assignedToFilter, setAssignedToFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);

  const limit = 20;

  // Fetch staff list for filter
  useEffect(() => {
    fetch('/api/booking-requests/staff')
      .then((res) => res.json())
      .then((data) => setStaffList(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchDebounce) params.set('search', searchDebounce);
      if (cityFilter !== 'all') params.set('city', cityFilter);
      if (assignedToFilter !== 'all') params.set('assigned_to', assignedToFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/booking-requests?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setBookings(json.data || []);
      setTotal(json.total || 0);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchDebounce, cityFilter, assignedToFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Reset page and clear selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusFilter, searchDebounce, cityFilter, assignedToFilter, dateFrom, dateTo]);

  // Clear selection when page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  const toggleSelectAll = () => {
    if (selectedIds.size === bookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookings.map((b) => b.id)));
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
      const res = await fetch('/api/booking-requests/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        fetchBookings();
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ export: 'true' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchDebounce) params.set('search', searchDebounce);
      if (cityFilter !== 'all') params.set('city', cityFilter);
      if (assignedToFilter !== 'all') params.set('assigned_to', assignedToFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/booking-requests?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const rows = (json.data || []).map((b: BookingRequest) => ({
        name: b.name,
        email: b.email,
        phone: b.phone,
        city: CITIES.find(c => c.value === b.city_interested)?.[isArabic ? 'ar' : 'en'] || b.city_interested,
        status: t(`status.${b.status}`),
        assignedTo: b.assigned_staff?.full_name || '',
        date: new Date(b.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }),
      }));
      const columns = [
        { key: 'name', header: t('table.name') },
        { key: 'email', header: t('table.email') },
        { key: 'phone', header: t('table.phone') },
        { key: 'city', header: t('table.city') },
        { key: 'status', header: t('table.status') },
        { key: 'assignedTo', header: t('table.assignedTo') },
        { key: 'date', header: t('table.date') },
      ];
      const csv = generateCsv(rows, columns);
      const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(/\//g, '-');
      downloadCsv(csv, `bookings-${dateStr}.csv`);
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
          onClick={() => setShowNewBooking(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
        >
          <Plus size={16} />
          {t('newRequest')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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

      {/* Advanced Filters */}
      <AdvancedFilters
        fields={[
          {
            key: 'city',
            label: t('filters.city'),
            type: 'select',
            options: [
              { value: 'all', label: t('filters.allCities') },
              ...CITIES.map((c) => ({ value: c.value, label: isArabic ? c.ar : c.en })),
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
          city: cityFilter,
          assigned_to: assignedToFilter,
          date_from: dateFrom,
          date_to: dateTo,
        }}
        onChange={(key, value) => {
          if (key === 'city') setCityFilter(value);
          if (key === 'assigned_to') setAssignedToFilter(value);
          if (key === 'date_from') setDateFrom(value);
          if (key === 'date_to') setDateTo(value);
        }}
        onClear={() => {
          setCityFilter('all');
          setAssignedToFilter('all');
          setDateFrom('');
          setDateTo('');
        }}
        activeCount={
          [cityFilter !== 'all', assignedToFilter !== 'all', !!dateFrom, !!dateTo].filter(Boolean).length
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
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={MessageSquare}
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
                      checked={bookings.length > 0 && selectedIds.size === bookings.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-coral focus:ring-coral/50"
                    />
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500">
                    {t('table.name')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                    {t('table.email')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">
                    {t('table.phone')}
                  </th>
                  <th className="text-start px-4 py-3 font-medium text-gray-500">
                    {t('table.city')}
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
                {bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${selectedIds.has(booking.id) ? 'bg-coral/5' : ''}`}
                    onClick={() => router.push(`bookings/${booking.id}`)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(booking.id)}
                        onChange={() => toggleSelect(booking.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 text-coral focus:ring-coral/50"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-navy">
                      {booking.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {booking.email}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell" dir="ltr">
                      {booking.phone}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">
                      {booking.city_interested}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={t(`status.${booking.status}`)}
                        variant={getBookingStatusVariant(booking.status)}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden xl:table-cell">
                      {booking.assigned_staff?.full_name || (
                        <span className="text-gray-400">{t('table.unassigned')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                      {formatDate(booking.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`bookings/${booking.id}`);
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
        statusOptions={BOOKING_STATUS_OPTIONS.map((s) => ({
          value: s,
          label: t(`status.${s}`),
        }))}
        loading={bulkLoading}
      />

      <BookingModal
        isOpen={showNewBooking}
        onClose={() => {
          setShowNewBooking(false);
          fetchBookings();
        }}
      />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  ChevronRight,
  ChevronLeft,
  DoorOpen,
  Filter as FilterIcon,
  X,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge, {
  getRoomStatusVariant,
} from '@/components/admin/shared/StatusBadge';
import EmptyState from '@/components/admin/shared/EmptyState';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';
import RoomDetailPanel from './RoomDetailPanel';
import { formatPrice } from '@/lib/utils';
import { useAuth } from '@/lib/auth/hooks';

const ROOM_STATUSES = ['available', 'occupied', 'maintenance', 'reserved'] as const;
const ROOM_TYPES = ['single', 'double', 'triple', 'suite'] as const;

interface RoomRow {
  id: string;
  room_number: string | null;
  apartment_id: string;
  apartment: { id: string; apartment_number: string; floor: number } | null;
  floor: number | null;
  room_type: string;
  bathroom_type: string;
  capacity: number;
  occupancy_mode: 'private' | 'shared';
  monthly_price: number;
  discounted_price: number | null;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

interface BuildingRoomsTabProps {
  buildingId: string;
  // Called after a successful inline delete so the parent BuildingDetail
  // can refresh its cached `room_stats.total` tab badge.
  onMutate?: () => void;
}

export default function BuildingRoomsTab({ buildingId, onMutate }: BuildingRoomsTabProps) {
  const t = useTranslations('admin.buildings.roomsTab');
  const tForm = useTranslations('admin.buildings.roomForm');
  const tStatus = useTranslations('admin.buildings.roomStatus');
  const tType = useTranslations('rooms.types');
  const tBath = useTranslations('rooms.bathroom');
  const tMode = useTranslations('rooms.occupancyMode');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();
  const { profile } = useAuth();

  const canCreate =
    !!profile &&
    (profile.role === 'super_admin' || profile.role === 'deputy_general_manager');
  const canEditRow =
    !!profile &&
    (profile.role === 'super_admin' ||
      profile.role === 'deputy_general_manager' ||
      profile.role === 'branch_manager');
  const canDeleteRow = canCreate;

  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [apartmentFilter, setApartmentFilter] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RoomRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const ChevronIcon = isArabic ? ChevronLeft : ChevronRight;
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const qs = new URLSearchParams({ building_id: buildingId, limit: '200' });
        if (statusFilter) qs.set('status', statusFilter);
        if (typeFilter) qs.set('room_type', typeFilter);
        const res = await fetch(`/api/admin/rooms?${qs.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          return;
        }
        const json = await res.json();
        setRooms(json.data ?? []);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load rooms:', err);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [buildingId, statusFilter, typeFilter, reloadKey]);

  // Distinct apartments from the loaded rooms — used for the filter dropdown.
  // Sorted by floor, then apartment_number, so the list reads top-to-bottom
  // the way an admin walking a stairwell would see it.
  const apartmentOptions = useMemo(() => {
    const seen = new Map<string, { id: string; apartment_number: string; floor: number }>();
    for (const r of rooms) {
      if (r.apartment && !seen.has(r.apartment.id)) {
        seen.set(r.apartment.id, r.apartment);
      }
    }
    return Array.from(seen.values()).sort(
      (a, b) =>
        a.floor - b.floor || a.apartment_number.localeCompare(b.apartment_number)
    );
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (apartmentFilter) {
      list = list.filter((r) => r.apartment_id === apartmentFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.room_number?.toLowerCase().includes(q));
    }
    return list;
  }, [rooms, search, apartmentFilter]);

  const hasFilters = !!(search || statusFilter || typeFilter || apartmentFilter);
  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setApartmentFilter('');
  }

  // `returnTo=list` tells RoomForm / RoomDetailPanel to bounce back to the
  // List sub-mode of the merged Floor Map tab on submit/delete instead of the
  // default Visual mode.
  const newRoomHref = `/${locale}/admin/buildings/${buildingId}/rooms/new?returnTo=list`;

  const onConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/rooms/${pendingDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const code = json?.error;
        if (code === 'roomHasAssignments') {
          toast.error(tForm('errors.roomHasAssignments'));
        } else {
          toast.error(tForm('toast.genericError'));
        }
        setPendingDelete(null);
        return;
      }
      toast.success(tForm('toast.deleted'));
      setPendingDelete(null);
      setReloadKey((k) => k + 1);
      router.refresh();
      onMutate?.();
    } catch (err) {
      console.error('Room delete failed:', err);
      toast.error(tForm('toast.genericError'));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, router, tForm, onMutate]);

  if (selectedRoomId) {
    return (
      <RoomDetailPanel
        roomId={selectedRoomId}
        onBack={() => setSelectedRoomId(null)}
        returnTo="list"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400 dark:text-[var(--admin-text-subtle)]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full ps-9 pe-3 py-2 border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface-2)] text-navy dark:text-[var(--admin-text)] placeholder:text-gray-400 dark:placeholder:text-[var(--admin-text-subtle)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-[var(--admin-border)] rounded-lg text-sm bg-white dark:bg-[var(--admin-surface-2)] text-navy dark:text-[var(--admin-text)] focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
          >
            <option value="">{t('allStatuses')}</option>
            {ROOM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-[var(--admin-border)] rounded-lg text-sm bg-white dark:bg-[var(--admin-surface-2)] text-navy dark:text-[var(--admin-text)] focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
          >
            <option value="">{t('allTypes')}</option>
            {ROOM_TYPES.map((rt) => (
              <option key={rt} value={rt}>
                {tType(rt)}
              </option>
            ))}
          </select>
          <select
            value={apartmentFilter}
            onChange={(e) => setApartmentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-[var(--admin-border)] rounded-lg text-sm bg-white dark:bg-[var(--admin-surface-2)] text-navy dark:text-[var(--admin-text)] focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
            lang="en"
            dir="ltr"
          >
            <option value="">{t('allApartments')}</option>
            {apartmentOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.apartment_number} · F{a.floor}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-[var(--admin-text-muted)] hover:text-navy dark:hover:text-[var(--admin-text)] hover:bg-gray-50 dark:hover:bg-[var(--admin-surface-2)] rounded-lg transition-colors"
            >
              <X size={14} />
              {t('clearFilters')}
            </button>
          )}
          {canCreate && (
            <Link
              href={newRoomHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus size={14} />
              {t('addRoom')}
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <EmptyState
            icon={DoorOpen}
            title={t('errorTitle')}
            description={t('errorDescription')}
          />
        ) : filteredRooms.length === 0 ? (
          <EmptyState
            icon={hasFilters ? FilterIcon : DoorOpen}
            title={hasFilters ? t('emptyFilteredTitle') : t('emptyTitle')}
            description={
              hasFilters ? t('emptyFilteredDescription') : t('emptyDescription')
            }
            action={
              !hasFilters && canCreate ? (
                <Link
                  href={newRoomHref}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
                >
                  <Plus size={14} />
                  {t('emptyCta')}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[var(--admin-surface-2)] border-b border-gray-200 dark:border-[var(--admin-border)]">
                <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-[var(--admin-text-muted)]">
                  <Th>{t('table.roomNumber')}</Th>
                  <Th>{t('table.apartment')}</Th>
                  <Th>{t('table.floor')}</Th>
                  <Th>{t('table.type')}</Th>
                  <Th>{t('table.bathroom')}</Th>
                  <Th align="end">{t('table.price')}</Th>
                  <Th>{t('table.status')}</Th>
                  <Th align="end" className="w-10">
                    <span className="sr-only">{t('rowActions')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[var(--admin-border)]">
                {filteredRooms.map((r) => {
                  const hasDiscount =
                    r.discounted_price !== null &&
                    r.discounted_price < r.monthly_price;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRoomId(r.id)}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-[var(--admin-surface-2)] transition-colors"
                    >
                      <Td>
                        <span className="font-medium text-navy dark:text-[var(--admin-text)]">
                          {r.room_number || (
                            <span className="text-gray-400 dark:text-[var(--admin-text-subtle)]">{t('unnumbered')}</span>
                          )}
                        </span>
                      </Td>
                      <Td className="text-gray-700 dark:text-[var(--admin-text-muted)]">
                        <span dir="ltr">{r.apartment?.apartment_number ?? '—'}</span>
                      </Td>
                      <Td className="tabular-nums text-gray-600 dark:text-[var(--admin-text-muted)]">
                        {r.floor ?? '—'}
                      </Td>
                      <Td className="text-gray-700 dark:text-[var(--admin-text-muted)]">
                        <div className="flex flex-col leading-tight">
                          <span>{tType(r.room_type)} {tMode(r.occupancy_mode)}</span>
                          <span className="text-xs text-gray-400 dark:text-[var(--admin-text-subtle)] tabular-nums">
                            {t('table.bedsLabel', { count: r.capacity })}
                          </span>
                        </div>
                      </Td>
                      <Td className="text-gray-600 dark:text-[var(--admin-text-muted)]">{tBath(r.bathroom_type)}</Td>
                      <Td align="end" className="tabular-nums">
                        {hasDiscount ? (
                          <span className="flex flex-col items-end">
                            <span className="text-coral font-semibold">
                              {formatPrice(r.discounted_price!)}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-[var(--admin-text-subtle)] line-through">
                              {formatPrice(r.monthly_price)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-navy dark:text-[var(--admin-text)] font-medium">
                            {formatPrice(r.monthly_price)}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge
                          label={tStatus(r.status)}
                          variant={getRoomStatusVariant(r.status)}
                        />
                      </Td>
                      <Td align="end">
                        <div className="flex items-center justify-end gap-1">
                          {canEditRow && (
                            <Link
                              href={`/${locale}/admin/buildings/${buildingId}/rooms/${r.id}/edit?returnTo=list`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 text-gray-400 dark:text-[var(--admin-text-subtle)] hover:text-coral dark:hover:text-coral hover:bg-coral/5 dark:hover:bg-coral/10 rounded transition-colors"
                              aria-label={t('rowEdit')}
                              title={t('rowEdit')}
                            >
                              <Pencil size={14} />
                            </Link>
                          )}
                          {canDeleteRow && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete(r);
                              }}
                              className="p-1.5 text-gray-400 dark:text-[var(--admin-text-subtle)] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                              aria-label={t('rowDelete')}
                              title={t('rowDelete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          {!canEditRow && !canDeleteRow && (
                            <ChevronIcon size={16} className="text-gray-300 dark:text-[var(--admin-text-subtle)]" />
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && filteredRooms.length > 0 && (
          <div className="px-4 py-2 text-xs text-gray-500 dark:text-[var(--admin-text-muted)] border-t border-gray-100 dark:border-[var(--admin-border)] bg-gray-50/50 dark:bg-[var(--admin-surface-2)]/50 tabular-nums">
            {t('summary', { count: filteredRooms.length })}
          </div>
        )}
      </div>

      {/* Footer note for screen readers / discoverability */}
      {!loading && !error && filteredRooms.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] inline-flex items-center gap-1.5">
          <BackIcon size={12} className="text-gray-300 dark:text-[var(--admin-text-subtle)]" />
          {t('clickHint')}
        </p>
      )}

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => (deleting ? null : setPendingDelete(null))}
        onConfirm={onConfirmDelete}
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

function Th({
  children,
  align,
  className,
}: {
  children?: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 font-medium ${
        align === 'end' ? 'text-end' : 'text-start'
      } ${className ?? ''}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
}: {
  children?: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 ${align === 'end' ? 'text-end' : 'text-start'} ${
        className ?? ''
      }`}
    >
      {children}
    </td>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-gray-100 dark:divide-[var(--admin-border)]">
      <div className="bg-gray-50 dark:bg-[var(--admin-surface-2)] h-10 border-b border-gray-200 dark:border-[var(--admin-border)]" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center px-4 py-3 gap-4">
          <div className="h-4 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse w-12" />
          <div className="h-4 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse w-8" />
          <div className="h-4 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse w-20" />
          <div className="flex-1" />
          <div className="h-4 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse w-16" />
          <div className="h-5 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-full animate-pulse w-20" />
        </div>
      ))}
    </div>
  );
}

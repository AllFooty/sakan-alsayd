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
}

export default function BuildingRoomsTab({ buildingId }: BuildingRoomsTabProps) {
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

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => r.room_number?.toLowerCase().includes(q));
  }, [rooms, search]);

  const hasFilters = !!(search || statusFilter || typeFilter);
  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
  }

  const newRoomHref = `/${locale}/admin/buildings/${buildingId}/rooms/new`;

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
    } catch (err) {
      console.error('Room delete failed:', err);
      toast.error(tForm('toast.genericError'));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, router, tForm]);

  if (selectedRoomId) {
    return (
      <RoomDetailPanel
        roomId={selectedRoomId}
        onBack={() => setSelectedRoomId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full ps-9 pe-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
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
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral"
          >
            <option value="">{t('allTypes')}</option>
            {ROOM_TYPES.map((rt) => (
              <option key={rt} value={rt}>
                {tType(rt)}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-navy hover:bg-gray-50 rounded-lg transition-colors"
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <EmptyState
            icon={DoorOpen}
            title={t('errorTitle')}
            description={t('errorDescription')}
          />
        ) : filteredRooms.length === 0 ? (
          <div>
            <EmptyState
              icon={hasFilters ? FilterIcon : DoorOpen}
              title={hasFilters ? t('emptyFilteredTitle') : t('emptyTitle')}
              description={
                hasFilters ? t('emptyFilteredDescription') : t('emptyDescription')
              }
            />
            {!hasFilters && canCreate && (
              <div className="flex justify-center pb-6 -mt-4">
                <Link
                  href={newRoomHref}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
                >
                  <Plus size={14} />
                  {t('addRoom')}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-xs uppercase tracking-wide text-gray-500">
                  <Th>{t('table.roomNumber')}</Th>
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
              <tbody className="divide-y divide-gray-100">
                {filteredRooms.map((r) => {
                  const hasDiscount =
                    r.discounted_price !== null &&
                    r.discounted_price < r.monthly_price;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRoomId(r.id)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Td>
                        <span className="font-medium text-navy">
                          {r.room_number || (
                            <span className="text-gray-400">{t('unnumbered')}</span>
                          )}
                        </span>
                      </Td>
                      <Td className="tabular-nums text-gray-600">
                        {r.floor ?? '—'}
                      </Td>
                      <Td className="text-gray-700">
                        <div className="flex flex-col leading-tight">
                          <span>{tType(r.room_type)} {tMode(r.occupancy_mode)}</span>
                          <span className="text-xs text-gray-400 tabular-nums">
                            {t('table.bedsLabel', { count: r.capacity })}
                          </span>
                        </div>
                      </Td>
                      <Td className="text-gray-600">{tBath(r.bathroom_type)}</Td>
                      <Td align="end" className="tabular-nums">
                        {hasDiscount ? (
                          <span className="flex flex-col items-end">
                            <span className="text-coral font-semibold">
                              {formatPrice(r.discounted_price!)}
                            </span>
                            <span className="text-xs text-gray-400 line-through">
                              {formatPrice(r.monthly_price)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-navy font-medium">
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
                              href={`/${locale}/admin/buildings/${buildingId}/rooms/${r.id}/edit`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 text-gray-400 hover:text-coral hover:bg-coral/5 rounded transition-colors"
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
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              aria-label={t('rowDelete')}
                              title={t('rowDelete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          {!canEditRow && !canDeleteRow && (
                            <ChevronIcon size={16} className="text-gray-300" />
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
          <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50/50 tabular-nums">
            {t('summary', { count: filteredRooms.length })}
          </div>
        )}
      </div>

      {/* Footer note for screen readers / discoverability */}
      {!loading && !error && filteredRooms.length > 0 && (
        <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
          <BackIcon size={12} className="text-gray-300" />
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
    <div className="divide-y divide-gray-100">
      <div className="bg-gray-50 h-10 border-b border-gray-200" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center px-4 py-3 gap-4">
          <div className="h-4 bg-gray-100 rounded animate-pulse w-12" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-8" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
          <div className="flex-1" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-16" />
          <div className="h-5 bg-gray-100 rounded-full animate-pulse w-20" />
        </div>
      ))}
    </div>
  );
}

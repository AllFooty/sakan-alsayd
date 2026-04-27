'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Edit2,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Power,
  KeyRound,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import StatusBadge from '@/components/admin/shared/StatusBadge';
import EmptyState from '@/components/admin/shared/EmptyState';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';
import AdvancedFilters from '@/components/admin/shared/AdvancedFilters';
import { useAuth } from '@/lib/auth/hooks';
import { formatDate } from '@/lib/utils';
import UserRoleBadge, { type UserRole } from './UserRoleBadge';
import UserModal, { type ManagedUser, type BuildingOption } from './UserModal';

const ROLES: UserRole[] = [
  'super_admin',
  'deputy_general_manager',
  'branch_manager',
  'maintenance_manager',
  'transportation_manager',
  'finance_manager',
  'maintenance_staff',
  'transportation_staff',
  'supervision_staff',
  'finance_staff',
];

type ConfirmKind = 'deactivate' | 'activate' | 'reset' | null;
type SortColumn = 'full_name' | 'role' | 'is_active' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function UsersList() {
  const t = useTranslations('admin.users');
  const tRoles = useTranslations('admin.topbar.roles');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; user: ManagedUser | null }>({
    kind: null,
    user: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const limit = 25;

  useEffect(() => {
    fetch('/api/buildings')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setBuildings(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort: sortColumn,
        dir: sortDir,
      });
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (activeFilter !== 'all') params.set('is_active', activeFilter);
      if (buildingFilter !== 'all') params.set('building_id', buildingFilter);
      if (searchDebounce) params.set('search', searchDebounce);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setUsers(json.data || []);
      setTotal(json.total || 0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, activeFilter, buildingFilter, searchDebounce, sortColumn, sortDir, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, activeFilter, buildingFilter, searchDebounce, sortColumn, sortDir]);

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDir(column === 'created_at' ? 'desc' : 'asc');
    }
  }

  const totalPages = Math.ceil(total / limit) || 1;

  function buildingShortLabel(b: BuildingOption) {
    return isArabic ? b.neighborhood_ar : b.neighborhood_en;
  }

  async function handleConfirmAction() {
    if (!confirm.user || !confirm.kind) return;
    setActionLoading(true);
    try {
      if (confirm.kind === 'deactivate' || confirm.kind === 'activate') {
        const nextActive = confirm.kind === 'activate';
        const res = await fetch(`/api/admin/users/${confirm.user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: nextActive }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errKey = typeof json.error === 'string' ? json.error : '';
          if (errKey === 'lastSuperAdmin') toast.error(t('errors.lastSuperAdmin'));
          else if (errKey === 'selfModify') toast.error(t('errors.selfModify'));
          else toast.error(t('toast.genericError'));
          return;
        }
        toast.success(
          nextActive
            ? t('toast.activated', { name: confirm.user.full_name })
            : t('toast.deactivated', { name: confirm.user.full_name })
        );
        fetchUsers();
      } else if (confirm.kind === 'reset') {
        const res = await fetch(`/api/admin/users/${confirm.user.id}/reset-password`, {
          method: 'POST',
        });
        if (!res.ok) {
          toast.error(t('toast.genericError'));
          return;
        }
        toast.success(t('toast.resetSent'));
      }
      setConfirm({ kind: null, user: null });
    } catch (err) {
      console.error('Action failed:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setActionLoading(false);
    }
  }

  const confirmTitle =
    confirm.kind === 'deactivate'
      ? t('confirm.deactivateTitle')
      : confirm.kind === 'activate'
      ? t('confirm.activateTitle')
      : confirm.kind === 'reset'
      ? t('confirm.resetTitle')
      : '';

  const confirmDescription =
    confirm.kind === 'deactivate' && confirm.user
      ? t('confirm.deactivateDescription', { name: confirm.user.full_name })
      : confirm.kind === 'activate' && confirm.user
      ? t('confirm.activateDescription', { name: confirm.user.full_name })
      : confirm.kind === 'reset' && confirm.user
      ? t('confirm.resetDescription', { email: confirm.user.email || '' })
      : '';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
        >
          <Plus size={16} />
          {t('inviteButton')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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

      <AdvancedFilters
        fields={[
          {
            key: 'role',
            label: t('filters.role'),
            type: 'select',
            options: [
              { value: 'all', label: t('filters.allRoles') },
              ...ROLES.map((r) => ({ value: r, label: tRoles(r) })),
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
          {
            key: 'building_id',
            label: t('filters.building'),
            type: 'select',
            options: [
              { value: 'all', label: t('filters.allBuildings') },
              ...buildings.map((b) => ({
                value: b.id,
                label: isArabic
                  ? `${b.city_ar} — ${b.neighborhood_ar}`
                  : `${b.city_en} — ${b.neighborhood_en}`,
              })),
            ],
          },
        ]}
        values={{
          role: roleFilter,
          is_active: activeFilter,
          building_id: buildingFilter,
        }}
        onChange={(key, value) => {
          if (key === 'role') setRoleFilter(value);
          if (key === 'is_active') setActiveFilter(value);
          if (key === 'building_id') setBuildingFilter(value);
        }}
        onClear={() => {
          setRoleFilter('all');
          setActiveFilter('all');
          setBuildingFilter('all');
        }}
        activeCount={
          [roleFilter !== 'all', activeFilter !== 'all', buildingFilter !== 'all'].filter(Boolean)
            .length
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
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            icon={UserCog}
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
                  <SortableHeader
                    label={t('table.name')}
                    column="full_name"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden md:table-cell">
                    {t('table.email')}
                  </th>
                  <SortableHeader
                    label={t('table.role')}
                    column="role"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="text-start px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">
                    {t('table.buildings')}
                  </th>
                  <SortableHeader
                    label={t('table.status')}
                    column="is_active"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label={t('table.createdAt')}
                    column="created_at"
                    sortColumn={sortColumn}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="hidden xl:table-cell"
                  />
                  <th className="text-end px-4 py-3 font-medium text-gray-500">
                    {t('table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                  <tr
                    key={u.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setEditing(u)}
                  >
                    <td className="px-4 py-3 font-medium text-navy">{u.full_name}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell" dir="ltr">
                      {u.email || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <UserRoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {u.role === 'super_admin' || u.role === 'deputy_general_manager' ? (
                        <span className="text-gray-400">{t('table.allBuildings')}</span>
                      ) : u.buildings.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span title={u.buildings.map(buildingShortLabel).join(', ')}>
                          {u.buildings.length === 1
                            ? buildingShortLabel(u.buildings[0])
                            : `${u.buildings.length}`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={u.is_active ? t('status.active') : t('status.inactive')}
                        variant={u.is_active ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">
                      {formatDate(u.created_at, isArabic ? 'ar' : 'en')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(u);
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-navy transition-colors"
                          title={t('actions.edit')}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelf) return;
                            setConfirm({
                              kind: u.is_active ? 'deactivate' : 'activate',
                              user: u,
                            });
                          }}
                          disabled={isSelf}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-navy transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          title={
                            isSelf
                              ? t('errors.selfModify')
                              : u.is_active
                              ? t('actions.deactivate')
                              : t('actions.activate')
                          }
                        >
                          <Power size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirm({ kind: 'reset', user: u });
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-navy transition-colors"
                          title={t('actions.resetPassword')}
                        >
                          <KeyRound size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                {t('pagination.summary', { count: total })}
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

      {/* Modals */}
      <UserModal
        isOpen={showInvite}
        mode="invite"
        buildings={buildings}
        onClose={() => setShowInvite(false)}
        onSaved={fetchUsers}
      />

      <UserModal
        isOpen={!!editing}
        mode="edit"
        user={editing}
        buildings={buildings}
        onClose={() => setEditing(null)}
        onSaved={fetchUsers}
      />

      <ConfirmDialog
        isOpen={!!confirm.kind}
        onClose={() => !actionLoading && setConfirm({ kind: null, user: null })}
        onConfirm={handleConfirmAction}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={t('confirm.confirm')}
        cancelLabel={t('confirm.cancel')}
        variant={confirm.kind === 'deactivate' ? 'danger' : 'warning'}
        loading={actionLoading}
      />
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

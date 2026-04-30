'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Info, Search, X, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_ROLES } from '@/lib/auth/permissions-matrix';
import type { UserRole } from '@/lib/auth/providers';
import PermissionsTable from './PermissionsTable';
import PermissionsRoleCards from './PermissionsRoleCards';

export default function RolesPermissionsMatrix() {
  const t = useTranslations('admin.rolesPermissions');
  const tRoles = useTranslations('admin.topbar.roles');
  const tLegend = useTranslations('admin.rolesPermissions.legend');

  const [search, setSearch] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Set<UserRole>>(
    new Set(ALL_ROLES)
  );

  const visibleRoles = ALL_ROLES.filter((r) => selectedRoles.has(r));
  const allSelected = selectedRoles.size === ALL_ROLES.length;

  function toggleRole(role: UserRole) {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        if (next.size === 1) return prev;
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  }

  function showAll() {
    setSelectedRoles(new Set(ALL_ROLES));
  }

  function clearFilters() {
    setSearch('');
    setSelectedRoles(new Set(ALL_ROLES));
  }

  const hasActiveFilters = search.trim() !== '' || !allSelected;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
        <Info size={18} className="text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" aria-hidden />
        <p className="text-sm text-amber-900 leading-relaxed">
          {t('readOnlyBanner')}
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="text-gray-500 dark:text-[var(--admin-text-muted)] font-medium">{t('legend.title')}</span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <Check size={12} strokeWidth={2.5} aria-hidden />
            </span>
            <span className="text-gray-700 dark:text-[var(--admin-text-muted)]">{tLegend('full')}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <Check size={12} strokeWidth={2.5} aria-hidden />
              <span className="absolute -bottom-0.5 end-0.5 w-1 h-1 rounded-full bg-amber-500" aria-hidden />
            </span>
            <span className="text-gray-700 dark:text-[var(--admin-text-muted)]">{tLegend('scoped')}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 text-gray-400 dark:text-[var(--admin-text-subtle)]">
              <Minus size={12} aria-hidden />
            </span>
            <span className="text-gray-700 dark:text-[var(--admin-text-muted)]">{tLegend('none')}</span>
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400 dark:text-[var(--admin-text-subtle)] pointer-events-none"
            aria-hidden
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('search.placeholder')}
            className="w-full ps-10 pe-10 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] focus:outline-none focus:ring-2 focus:ring-coral/40 focus:border-coral"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute top-1/2 -translate-y-1/2 end-2 p-1 rounded-md text-gray-400 dark:text-[var(--admin-text-subtle)] hover:text-gray-600 dark:text-[var(--admin-text-muted)] hover:bg-gray-100 dark:bg-[var(--admin-surface-2)]"
              aria-label={t('search.clear')}
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-[var(--admin-text-muted)]">
              {t('filterRoles')}
            </span>
            {!allSelected && (
              <button
                type="button"
                onClick={showAll}
                className="text-xs text-coral hover:text-coral/80 font-medium"
              >
                {t('showAllRoles')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ROLES.map((role) => {
              const active = selectedRoles.has(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  aria-pressed={active}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full border transition-colors',
                    active
                      ? 'bg-navy text-white border-navy'
                      : 'bg-white dark:bg-[var(--admin-surface)] text-gray-600 dark:text-[var(--admin-text-muted)] border-gray-300 dark:border-[var(--admin-border)] hover:border-navy hover:text-navy dark:text-[var(--admin-text)]'
                  )}
                >
                  {tRoles(role)}
                </button>
              );
            })}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] hover:text-navy dark:text-[var(--admin-text)]"
            >
              {t('clearFilters')}
            </button>
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <PermissionsTable visibleRoles={visibleRoles} search={search} />
      </div>
      <div className="md:hidden">
        <PermissionsRoleCards visibleRoles={visibleRoles} search={search} />
      </div>
    </div>
  );
}

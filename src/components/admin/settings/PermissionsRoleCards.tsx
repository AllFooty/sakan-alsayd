'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Info, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PERMISSIONS_MATRIX,
  getAccess,
  type Access,
} from '@/lib/auth/permissions-matrix';
import type { UserRole } from '@/lib/auth/providers';
import { highlight } from './highlight';

interface PermissionsRoleCardsProps {
  visibleRoles: UserRole[];
  search: string;
}

function AccessIcon({ access }: { access: Access }) {
  if (access === 'none') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 text-gray-400 dark:text-[var(--admin-text-subtle)] shrink-0">
        <Minus size={14} aria-hidden />
      </span>
    );
  }
  if (access === 'full') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shrink-0">
        <Check size={14} strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  return (
    <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 shrink-0">
      <Check size={14} strokeWidth={2.5} aria-hidden />
      <span
        className="absolute -bottom-0.5 end-0.5 w-1.5 h-1.5 rounded-full bg-amber-500"
        aria-hidden
      />
    </span>
  );
}

export default function PermissionsRoleCards({
  visibleRoles,
  search,
}: PermissionsRoleCardsProps) {
  const tGroups = useTranslations('admin.rolesPermissions.groups');
  const tPerms = useTranslations('admin.rolesPermissions.permissions');
  const tScope = useTranslations('admin.rolesPermissions.scope');
  const tNotes = useTranslations('admin.rolesPermissions.notes');
  const tRoles = useTranslations('admin.topbar.roles');
  const t = useTranslations('admin.rolesPermissions');
  const tLegend = useTranslations('admin.rolesPermissions.legend');

  const [activeRole, setActiveRole] = useState<UserRole>(visibleRoles[0] ?? 'super_admin');

  const role = visibleRoles.includes(activeRole) ? activeRole : visibleRoles[0];
  if (!role) return null;

  const matchedGroups = PERMISSIONS_MATRIX.map((group) => {
    const rows = group.rows.filter((row) => {
      if (!search.trim()) return true;
      const needle = search.trim().toLowerCase();
      const label = tPerms(row.key).toLowerCase();
      const scope = row.scopeNoteKey ? tScope(row.scopeNoteKey).toLowerCase() : '';
      return label.includes(needle) || scope.includes(needle);
    });
    return { ...group, rows };
  }).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-2 p-1 rounded-xl bg-gray-50 dark:bg-[var(--admin-bg)] border border-gray-200 dark:border-[var(--admin-border)]"
        role="group"
        aria-label={t('mobileRolePicker')}
      >
        {visibleRoles.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={r === role}
            onClick={() => setActiveRole(r)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              r === role
                ? 'bg-white dark:bg-[var(--admin-surface)] text-navy dark:text-[var(--admin-text)] shadow-sm'
                : 'text-gray-600 dark:text-[var(--admin-text-muted)] hover:text-navy dark:text-[var(--admin-text)]'
            )}
          >
            {tRoles(r)}
          </button>
        ))}
      </div>

      {matchedGroups.length === 0 ? (
        <div className="rounded-xl border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">{t('search.noResults')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matchedGroups.map((group) => (
            <div
              key={group.key}
              className="rounded-xl border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] overflow-hidden"
            >
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-[var(--admin-bg)] border-b border-gray-200 dark:border-[var(--admin-border)]">
                <h3 className="text-sm font-semibold text-navy dark:text-[var(--admin-text)]">{tGroups(group.key)}</h3>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-[var(--admin-border)]">
                {group.rows.map((row) => {
                  const access = getAccess(row, role);
                  const scope = row.scopeNoteKey ? tScope(row.scopeNoteKey) : null;
                  const note = row.noteKey ? tNotes(row.noteKey) : null;
                  const label = tPerms(row.key);
                  return (
                    <li
                      key={row.key}
                      className="px-4 py-3 flex items-start gap-3"
                    >
                      <AccessIcon access={access} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-navy dark:text-[var(--admin-text)]">
                          {highlight(label, search)}
                        </div>
                        {access !== 'none' && (
                          <div className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">
                            {tLegend(access)}
                            {scope && access === 'scoped' ? ` — ${scope}` : ''}
                          </div>
                        )}
                        {note && (
                          <div className="mt-1 inline-flex items-start gap-1 text-xs text-amber-800 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded px-1.5 py-0.5">
                            <Info size={11} className="mt-0.5 shrink-0" aria-hidden />
                            <span>{note}</span>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

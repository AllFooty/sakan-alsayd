'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PERMISSIONS_MATRIX,
  getAccess,
  type PermissionRow,
} from '@/lib/auth/permissions-matrix';
import type { UserRole } from '@/lib/auth/providers';
import PermissionCell from './PermissionCell';
import { highlight } from './highlight';

interface PermissionsTableProps {
  visibleRoles: UserRole[];
  search: string;
}

const SESSION_KEY = 'sakan-rp-collapsed-groups';

function loadCollapsedFromSession(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function rowMatchesSearch(label: string, scope: string | null, search: string): boolean {
  if (!search) return true;
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  if (label.toLowerCase().includes(needle)) return true;
  if (scope && scope.toLowerCase().includes(needle)) return true;
  return false;
}

export default function PermissionsTable({ visibleRoles, search }: PermissionsTableProps) {
  const tGroups = useTranslations('admin.rolesPermissions.groups');
  const tPerms = useTranslations('admin.rolesPermissions.permissions');
  const tScope = useTranslations('admin.rolesPermissions.scope');
  const tNotes = useTranslations('admin.rolesPermissions.notes');
  const tRoles = useTranslations('admin.topbar.roles');
  const t = useTranslations('admin.rolesPermissions');

  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsedFromSession);

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore — sessionStorage may be unavailable (private browsing, etc.)
      }
      return next;
    });
  }

  function rowLabel(row: PermissionRow): string {
    return tPerms(row.key);
  }

  function rowScope(row: PermissionRow): string | null {
    return row.scopeNoteKey ? tScope(row.scopeNoteKey) : null;
  }

  function rowNote(row: PermissionRow): string | null {
    return row.noteKey ? tNotes(row.noteKey) : null;
  }

  const filteredGroups = PERMISSIONS_MATRIX.map((group) => ({
    ...group,
    rows: group.rows.filter((row) => rowMatchesSearch(rowLabel(row), rowScope(row), search)),
  })).filter((group) => group.rows.length > 0);

  if (filteredGroups.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">{t('search.noResults')}</p>
      </div>
    );
  }

  const colCount = visibleRoles.length + 1;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-max border-separate border-spacing-0 w-full">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky start-0 top-0 z-30 bg-gray-50 dark:bg-[var(--admin-bg)] border-b border-e border-gray-200 dark:border-[var(--admin-border)] px-4 py-3 text-start text-xs font-semibold text-gray-600 dark:text-[var(--admin-text-muted)] uppercase tracking-wide min-w-[280px]"
              >
                {t('table.permission')}
              </th>
              {visibleRoles.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="sticky top-0 z-20 bg-gray-50 dark:bg-[var(--admin-bg)] border-b border-gray-200 dark:border-[var(--admin-border)] px-2 py-3 text-xs font-medium text-gray-700 dark:text-[var(--admin-text-muted)] align-bottom min-w-[120px] max-w-[160px]"
                >
                  <div className="text-center leading-tight whitespace-normal break-words px-1">
                    {tRoles(role)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group) => {
              const isCollapsed = collapsed.has(group.key);
              return (
                <Fragment key={group.key}>
                  <tr className="bg-gray-50 dark:bg-[var(--admin-bg)]">
                    <th
                      colSpan={colCount}
                      scope="colgroup"
                      className="sticky start-0 z-10 border-b border-gray-200 dark:border-[var(--admin-border)] px-4 py-2 text-start"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className="flex items-center gap-2 text-sm font-semibold text-navy dark:text-[var(--admin-text)] hover:text-coral transition-colors"
                        aria-expanded={!isCollapsed}
                        aria-controls={`group-${group.key}`}
                      >
                        {isCollapsed ? (
                          <ChevronRight
                            size={16}
                            className="rtl:rotate-180"
                            aria-hidden
                          />
                        ) : (
                          <ChevronDown size={16} aria-hidden />
                        )}
                        <span>{tGroups(group.key)}</span>
                        <span className="text-xs font-normal text-gray-500 dark:text-[var(--admin-text-muted)]">
                          ({group.rows.length})
                        </span>
                      </button>
                    </th>
                  </tr>
                  {!isCollapsed &&
                    group.rows.map((row, idx) => {
                      const label = rowLabel(row);
                      const scope = rowScope(row);
                      const note = rowNote(row);
                      return (
                        <tr
                          key={row.key}
                          id={`group-${group.key}`}
                          className={cn(
                            'hover:bg-gray-50/60 dark:bg-[var(--admin-surface-2)]/60 transition-colors',
                            idx % 2 === 1 && 'bg-gray-50/30'
                          )}
                        >
                          <th
                            scope="row"
                            className="sticky start-0 z-10 bg-inherit border-b border-e border-gray-100 dark:border-[var(--admin-border)] px-4 py-2.5 text-start font-normal align-top"
                          >
                            <div className="text-sm text-navy dark:text-[var(--admin-text)]">
                              {highlight(label, search)}
                            </div>
                            {scope && (
                              <div className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">
                                {scope}
                              </div>
                            )}
                            {note && (
                              <div className="mt-1 inline-flex items-start gap-1 text-xs text-amber-800 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded px-1.5 py-0.5">
                                <Info size={11} className="mt-0.5 shrink-0" aria-hidden />
                                <span>{note}</span>
                              </div>
                            )}
                          </th>
                          {visibleRoles.map((role) => (
                            <td
                              key={role}
                              className="border-b border-gray-100 dark:border-[var(--admin-border)] px-2 py-2.5 text-center align-middle"
                            >
                              <PermissionCell
                                access={getAccess(row, role)}
                                scopeNoteKey={row.scopeNoteKey}
                                roleLabel={tRoles(role)}
                                permissionLabel={label}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

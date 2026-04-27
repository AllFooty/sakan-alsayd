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
      <span className="inline-flex items-center justify-center w-6 h-6 text-gray-400 shrink-0">
        <Minus size={14} aria-hidden />
      </span>
    );
  }
  if (access === 'full') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
        <Check size={14} strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  return (
    <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-700 shrink-0">
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
        className="flex flex-wrap gap-2 p-1 rounded-xl bg-gray-50 border border-gray-200"
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
                ? 'bg-white text-navy shadow-sm'
                : 'text-gray-600 hover:text-navy'
            )}
          >
            {tRoles(r)}
          </button>
        ))}
      </div>

      {matchedGroups.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-500">{t('search.noResults')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matchedGroups.map((group) => (
            <div
              key={group.key}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden"
            >
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-navy">{tGroups(group.key)}</h3>
              </div>
              <ul className="divide-y divide-gray-100">
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
                        <div className="text-sm text-navy">
                          {highlight(label, search)}
                        </div>
                        {access !== 'none' && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {tLegend(access)}
                            {scope && access === 'scoped' ? ` — ${scope}` : ''}
                          </div>
                        )}
                        {note && (
                          <div className="mt-1 inline-flex items-start gap-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
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

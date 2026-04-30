'use client';

import { Check, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Access, ScopeKey } from '@/lib/auth/permissions-matrix';

interface PermissionCellProps {
  access: Access;
  scopeNoteKey?: ScopeKey;
  roleLabel: string;
  permissionLabel: string;
}

export default function PermissionCell({
  access,
  scopeNoteKey,
  roleLabel,
  permissionLabel,
}: PermissionCellProps) {
  const tLegend = useTranslations('admin.rolesPermissions.legend');
  const tScope = useTranslations('admin.rolesPermissions.scope');

  const accessLabel = tLegend(access);
  const scopeLabel = scopeNoteKey ? tScope(scopeNoteKey) : null;
  const ariaLabel = `${roleLabel}: ${accessLabel} — ${permissionLabel}${scopeLabel ? ` (${scopeLabel})` : ''}`;

  if (access === 'none') {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 text-gray-400 dark:text-[var(--admin-text-subtle)]"
        aria-label={ariaLabel}
        title={`${accessLabel}: ${permissionLabel}`}
      >
        <Minus size={16} aria-hidden />
      </span>
    );
  }

  if (access === 'full') {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        aria-label={ariaLabel}
        title={`${accessLabel}: ${permissionLabel}`}
      >
        <Check size={16} strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
      )}
      aria-label={ariaLabel}
      title={scopeLabel ? `${accessLabel} — ${scopeLabel}` : accessLabel}
    >
      <Check size={16} strokeWidth={2.5} aria-hidden />
      <span
        className="absolute -bottom-0.5 end-0.5 w-1.5 h-1.5 rounded-full bg-amber-500"
        aria-hidden
      />
    </span>
  );
}

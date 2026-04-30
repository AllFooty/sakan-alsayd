'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export type UserRole =
  | 'super_admin'
  | 'deputy_general_manager'
  | 'branch_manager'
  | 'maintenance_manager'
  | 'transportation_manager'
  | 'finance_manager'
  | 'maintenance_staff'
  | 'transportation_staff'
  | 'supervision_staff'
  | 'finance_staff';

// Tier shading: super/deputy share coral; branch is navy; department managers
// use the X-300 shade and their staff peers use X-200. Both shades have enough
// contrast against the cream `#F5F0EB` page background; the lighter X-100s
// previously used for staff badges nearly disappeared on cream.
const roleStyles: Record<UserRole, string> = {
  super_admin: 'bg-coral/10 text-coral',
  deputy_general_manager: 'bg-coral/10 text-coral',
  branch_manager: 'bg-navy/10 text-navy dark:text-[var(--admin-text)]',
  maintenance_manager: 'bg-amber-300 text-amber-900',
  transportation_manager: 'bg-purple-300 text-purple-900',
  finance_manager: 'bg-emerald-300 text-emerald-900',
  maintenance_staff: 'bg-amber-200 text-amber-900',
  transportation_staff: 'bg-purple-200 text-purple-900',
  supervision_staff: 'bg-blue-200 text-blue-900',
  finance_staff: 'bg-emerald-200 text-emerald-900',
};

interface UserRoleBadgeProps {
  role: UserRole;
  className?: string;
}

export default function UserRoleBadge({ role, className }: UserRoleBadgeProps) {
  const t = useTranslations('admin.topbar.roles');
  const label = t(role);
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium max-w-[14rem] truncate',
        roleStyles[role],
        className
      )}
      title={label}
    >
      {label}
    </span>
  );
}

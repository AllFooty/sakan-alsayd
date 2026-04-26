'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export type UserRole =
  | 'super_admin'
  | 'branch_manager'
  | 'maintenance_staff'
  | 'transportation_staff'
  | 'supervision_staff'
  | 'finance_staff';

const roleStyles: Record<UserRole, string> = {
  super_admin: 'bg-coral/10 text-coral',
  branch_manager: 'bg-navy/10 text-navy',
  maintenance_staff: 'bg-amber-100 text-amber-800',
  transportation_staff: 'bg-purple-100 text-purple-800',
  supervision_staff: 'bg-blue-100 text-blue-800',
  finance_staff: 'bg-emerald-100 text-emerald-800',
};

interface UserRoleBadgeProps {
  role: UserRole;
  className?: string;
}

export default function UserRoleBadge({ role, className }: UserRoleBadgeProps) {
  const t = useTranslations('admin.topbar.roles');
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        roleStyles[role],
        className
      )}
    >
      {t(role)}
    </span>
  );
}

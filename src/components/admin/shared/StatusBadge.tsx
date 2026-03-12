import { cn } from '@/lib/utils';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-600',
};

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export default function StatusBadge({
  label,
  variant = 'default',
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {label}
    </span>
  );
}

export function getBookingStatusVariant(
  status: string
): BadgeVariant {
  switch (status) {
    case 'new':
      return 'info';
    case 'in_review':
      return 'warning';
    case 'pending_payment':
      return 'warning';
    case 'pending_onboarding':
      return 'info';
    case 'completed':
      return 'success';
    case 'rejected':
      return 'error';
    case 'cancelled':
      return 'neutral';
    // Legacy statuses
    case 'contacted':
      return 'warning';
    case 'confirmed':
      return 'success';
    default:
      return 'default';
  }
}

export function getMaintenanceStatusVariant(
  status: string
): BadgeVariant {
  switch (status) {
    case 'submitted':
      return 'info';
    case 'assigned':
      return 'warning';
    case 'in_progress':
      return 'warning';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'neutral';
    default:
      return 'default';
  }
}

export function getMaintenancePriorityVariant(
  priority: string
): BadgeVariant {
  switch (priority) {
    case 'low':
      return 'success';
    case 'medium':
      return 'warning';
    case 'high':
      return 'error';
    case 'urgent':
      return 'error';
    default:
      return 'default';
  }
}

export function getRoomStatusVariant(
  status: string
): BadgeVariant {
  switch (status) {
    case 'available':
      return 'success';
    case 'occupied':
      return 'info';
    case 'maintenance':
      return 'warning';
    case 'reserved':
      return 'warning';
    default:
      return 'default';
  }
}

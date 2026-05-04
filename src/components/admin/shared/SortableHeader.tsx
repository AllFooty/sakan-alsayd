'use client';

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

interface SortableHeaderProps {
  field: string;
  activeField: string | null;
  direction: SortDirection;
  onSort: (field: string) => void;
  children: React.ReactNode;
  className?: string;
}

// Renders a clickable column header with an asc/desc chevron and the right
// `aria-sort` value so screen readers announce the current sort state.
// Clicking the active field flips direction; clicking a different field
// switches and resets to descending.
export default function SortableHeader({
  field,
  activeField,
  direction,
  onSort,
  children,
  className,
}: SortableHeaderProps) {
  const isActive = activeField === field;
  const ariaSort: 'ascending' | 'descending' | 'none' = isActive
    ? direction === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';
  const Icon = isActive ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th aria-sort={ariaSort} className={cn('px-4 py-3 text-start', className)}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors rounded',
          'focus:outline-none focus:ring-2 focus:ring-coral/50',
          isActive
            ? 'text-navy dark:text-[var(--admin-text)]'
            : 'text-gray-500 dark:text-[var(--admin-text-muted)] hover:text-navy dark:hover:text-[var(--admin-text)]'
        )}
      >
        {children}
        <Icon
          size={12}
          className={cn(
            'transition-opacity',
            isActive ? 'opacity-100' : 'opacity-40'
          )}
        />
      </button>
    </th>
  );
}

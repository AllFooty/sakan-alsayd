'use client';

import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const reactId = useId();
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-') || reactId;
    const errorId = `${selectId}-error`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'w-full px-4 py-3 rounded-xl border bg-white dark:bg-[var(--admin-surface)] text-navy dark:text-[var(--admin-text)] appearance-none',
              'focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent',
              'transition-all duration-200 cursor-pointer',
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-border dark:border-[var(--admin-border)] hover:border-coral/50',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute end-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground dark:text-[var(--admin-text-muted)] pointer-events-none" />
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-sm text-red-500">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };

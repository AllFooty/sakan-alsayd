'use client';

import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const reactId = useId();
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-') || reactId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const describedBy = error ? errorId : helperText ? helperId : undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full px-4 py-3 rounded-xl border bg-white dark:bg-[var(--admin-surface)] text-navy dark:text-[var(--admin-text)] placeholder:text-muted-foreground dark:placeholder:text-[var(--admin-text-subtle)]',
            'focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent',
            'transition-all duration-200',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-border dark:border-[var(--admin-border)] hover:border-coral/50',
            className
          )}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            role="alert"
            aria-live="assertive"
            className="mt-1.5 text-sm text-red-500"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-sm text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };

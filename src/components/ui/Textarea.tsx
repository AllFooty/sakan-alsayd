'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-2"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full px-4 py-3 rounded-xl border bg-white dark:bg-[var(--admin-surface)] text-navy dark:text-[var(--admin-text)] placeholder:text-muted-foreground dark:placeholder:text-[var(--admin-text-subtle)]',
            'focus:outline-none focus:ring-2 focus:ring-coral focus:border-transparent',
            'transition-all duration-200 resize-none min-h-[120px]',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-border dark:border-[var(--admin-border)] hover:border-coral/50',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-500">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-muted-foreground">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };

'use client';

import { useEffect } from 'react';
import FocusLock from 'react-focus-lock';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <FocusLock returnFocus>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-[var(--admin-surface)] rounded-2xl shadow-xl max-w-md w-full p-6">
        <button
          onClick={onClose}
          className="absolute top-4 end-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[var(--admin-surface-2)]"
          aria-label="Close"
        >
          <X size={18} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              variant === 'danger'
                ? 'bg-red-100 dark:bg-red-500/20'
                : 'bg-yellow-100 dark:bg-yellow-500/20'
            )}
          >
            <AlertTriangle
              size={20}
              className={
                variant === 'danger'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-yellow-600 dark:text-yellow-400'
              }
            />
          </div>
          <div>
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-navy dark:text-[var(--admin-text)]">{title}</h3>
            <p id="confirm-dialog-description" className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)] mt-1">{description}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[var(--admin-text)] bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-lg hover:bg-gray-200 dark:hover:bg-[var(--admin-border)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50',
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-yellow-600 hover:bg-yellow-700'
            )}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
    </FocusLock>
  );
}

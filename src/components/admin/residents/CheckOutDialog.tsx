'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X, Calendar, Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDate } from '@/lib/utils';

interface Props {
  assignmentId: string;
  residentName: string;
  checkInDate: string;
  buildingNeighborhoodLabel: string | null;
  roomLabel: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_REASON = 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CheckOutDialog({
  assignmentId,
  residentName,
  checkInDate,
  buildingNeighborhoodLabel,
  roomLabel,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const t = useTranslations('admin.residents');
  const locale = useLocale();
  const isArabic = locale === 'ar';

  const [checkOutDate, setCheckOutDate] = useState(todayISO());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCheckOutDate(todayISO());
      setReason('');
      setError(null);
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
      if (e.key === 'Escape' && !submitting) onClose();
    }
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, submitting, onClose]);

  const dateValid = useMemo(() => {
    if (!DATE_RE.test(checkOutDate)) return false;
    return checkOutDate >= checkInDate;
  }, [checkOutDate, checkInDate]);

  if (!isOpen) return null;

  const subtitleLine: string = (() => {
    const parts: string[] = [];
    if (buildingNeighborhoodLabel) parts.push(buildingNeighborhoodLabel);
    if (roomLabel) parts.push(roomLabel);
    return parts.join(' · ');
  })();

  async function handleSubmit() {
    setError(null);
    if (!DATE_RE.test(checkOutDate)) {
      setError(t('checkOut.validation.dateRequired'));
      return;
    }
    if (checkOutDate < checkInDate) {
      setError(t('checkOut.validation.dateAfterCheckIn'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/assignments/${assignmentId}/check-out`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          check_out_date: checkOutDate,
          reason: reason.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        const code = json.error;
        if (code === 'checkOutBeforeCheckIn' || code === 'invalidCheckOutDate') {
          setError(t('checkOut.validation.dateAfterCheckIn'));
        } else {
          toast.error(t('checkOut.toast.error'));
        }
        return;
      }
      toast.success(t('checkOut.toast.success'));
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Check-out failed:', err);
      toast.error(t('checkOut.toast.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-[var(--admin-surface)] rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-[var(--admin-border)]">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <LogOut size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-navy dark:text-[var(--admin-text)]">
                {t('checkOut.title')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">
                {t('checkOut.subtitleWithRoom', { name: residentName })}
              </p>
              {subtitleLine && (
                <p className="text-xs text-gray-400 dark:text-[var(--admin-text-subtle)] mt-0.5">{subtitleLine}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-md text-gray-400 dark:text-[var(--admin-text-subtle)] hover:text-gray-600 dark:text-[var(--admin-text-muted)] hover:bg-gray-100 dark:bg-[var(--admin-surface-2)] disabled:opacity-50 transition-colors"
            aria-label={t('checkOut.actions.cancel')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Check-in info row */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-[var(--admin-bg)] text-sm">
            <Calendar size={14} className="text-gray-400 dark:text-[var(--admin-text-subtle)] flex-shrink-0" />
            <span className="text-gray-500 dark:text-[var(--admin-text-muted)]">{t('checkOut.info.checkInLabel')}:</span>
            <span className="text-gray-700 dark:text-[var(--admin-text-muted)] tabular-nums">
              {formatDate(checkInDate, isArabic ? 'ar' : 'en')}
            </span>
          </div>

          {/* Check-out date */}
          <div>
            <label
              htmlFor="check-out-date"
              className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1.5"
            >
              {t('checkOut.fields.checkOutDate')}
            </label>
            <div className="relative">
              <input
                id="check-out-date"
                type="date"
                lang="en"
                value={checkOutDate}
                min={checkInDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className={cn(
                  'block w-full rounded-lg border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] px-3 py-2 text-sm text-navy dark:text-[var(--admin-text)] shadow-sm focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral',
                  !checkOutDate && 'text-transparent'
                )}
              />
              {!checkOutDate && (
                <span className="absolute inset-y-0 start-3 flex items-center pointer-events-none text-sm text-gray-400 dark:text-[var(--admin-text-subtle)]">
                  {isArabic ? 'يوم/شهر/سنة' : 'DD/MM/YYYY'}
                </span>
              )}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label
              htmlFor="check-out-reason"
              className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1.5"
            >
              {t('checkOut.fields.reason')}
            </label>
            <textarea
              id="check-out-reason"
              value={reason}
              onChange={(e) =>
                setReason(e.target.value.slice(0, MAX_REASON))
              }
              placeholder={t('checkOut.placeholders.reason')}
              rows={3}
              className="block w-full rounded-lg border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] px-3 py-2 text-sm text-navy dark:text-[var(--admin-text)] shadow-sm focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral resize-none"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-[var(--admin-text-subtle)] text-end tabular-nums">
              {t('checkOut.charCounter', { count: reason.length })}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-[var(--admin-border)] bg-gray-50 dark:bg-[var(--admin-bg)]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-[var(--admin-text-muted)] bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] rounded-lg hover:bg-gray-50 dark:bg-[var(--admin-bg)] disabled:opacity-50 transition-colors"
          >
            {t('checkOut.actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !dateValid}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-coral rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? t('checkOut.actions.confirming') : t('checkOut.actions.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

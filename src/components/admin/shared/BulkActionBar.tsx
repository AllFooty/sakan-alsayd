'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Loader2 } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onChangeStatus: (status: string) => void;
  onDelete: () => void;
  onClear: () => void;
  statusOptions: { value: string; label: string }[];
  loading?: boolean;
}

export default function BulkActionBar({
  selectedCount,
  onChangeStatus,
  onDelete,
  onClear,
  statusOptions,
  loading = false,
}: BulkActionBarProps) {
  const t = useTranslations('admin.bulk');
  const [selectedStatus, setSelectedStatus] = useState('');

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 animate-slide-up">
      <div className="mx-auto max-w-5xl px-4 pb-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-navy px-4 py-3 text-white shadow-2xl sm:gap-4 sm:px-6">
          {/* Selected count */}
          <span className="text-sm font-medium whitespace-nowrap">
            {t('selected', { count: selectedCount })}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Status change */}
            <div className="hidden sm:flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                disabled={loading}
                className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-coral/50 disabled:opacity-50"
              >
                <option value="" className="text-gray-900">
                  {t('changeStatus')}
                </option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-gray-900">
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (selectedStatus) {
                    onChangeStatus(selectedStatus);
                    setSelectedStatus('');
                  }
                }}
                disabled={!selectedStatus || loading}
                className="rounded-lg bg-coral px-3 py-1.5 text-sm font-medium text-white hover:bg-coral/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : t('apply')}
              </button>
            </div>

            {/* Mobile status change - compact dropdown that auto-applies */}
            <div className="sm:hidden">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    onChangeStatus(e.target.value);
                  }
                }}
                disabled={loading}
                className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white focus:outline-none disabled:opacity-50"
              >
                <option value="" className="text-gray-900">
                  {t('changeStatus')}
                </option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-gray-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Delete button */}
            <button
              onClick={onDelete}
              disabled={loading}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {t('deleteSelected')}
            </button>

            {/* Clear button */}
            <button
              onClick={onClear}
              disabled={loading}
              className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              title={t('clear')}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

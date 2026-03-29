'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

export interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'date';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface AdvancedFiltersProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  activeCount: number;
  filterLabel: string;
  clearLabel: string;
}

export default function AdvancedFilters({
  fields,
  values,
  onChange,
  onClear,
  activeCount,
  filterLabel,
  clearLabel,
}: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            open || activeCount > 0
              ? 'bg-coral text-white border border-coral'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {filterLabel}
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-coral text-white text-xs font-bold">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-3 h-3" />
            {clearLabel}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select
                  value={values[field.key] || ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 bg-white"
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="date"
                  value={values[field.key] || ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 bg-white"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

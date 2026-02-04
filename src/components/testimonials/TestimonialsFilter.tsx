'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { FilterType } from './TestimonialsPageContent';

interface TestimonialsFilterProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  isArabic: boolean;
}

const filterOptions: { key: FilterType; translationKey: string }[] = [
  { key: 'all', translationKey: 'all' },
  { key: 'quote', translationKey: 'quotes' },
  { key: 'screenshot', translationKey: 'screenshots' },
  { key: 'video', translationKey: 'videos' },
];

export default function TestimonialsFilter({
  activeFilter,
  onFilterChange,
  isArabic,
}: TestimonialsFilterProps) {
  const t = useTranslations('testimonials.filters');

  return (
    <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-10">
      {filterOptions.map((option) => (
        <button
          key={option.key}
          onClick={() => onFilterChange(option.key)}
          className={cn(
            'px-5 py-2.5 rounded-full text-sm md:text-base font-medium transition-all duration-200',
            activeFilter === option.key
              ? 'bg-coral text-white shadow-md'
              : 'bg-white text-navy/70 hover:bg-coral/10 hover:text-coral border border-navy/10'
          )}
        >
          {t(option.translationKey)}
        </button>
      ))}
    </div>
  );
}

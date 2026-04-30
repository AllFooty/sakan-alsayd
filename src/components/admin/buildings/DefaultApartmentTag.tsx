'use client';

import { Sparkles } from 'lucide-react';

interface DefaultApartmentTagProps {
  // Tooltip text — explains *why* the tag is here and what to do about it.
  title: string;
  // Visible label (typically a single word like "Default" / "تلقائي").
  label: string;
}

// Visual marker for `F{n}-DEFAULT` apartments left over from migration 028's
// backfill. Used by ApartmentDetail and BuildingFloorMap apartment headers.
export default function DefaultApartmentTag({
  title,
  label,
}: DefaultApartmentTagProps) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-medium"
    >
      <Sparkles size={10} />
      {label}
    </span>
  );
}

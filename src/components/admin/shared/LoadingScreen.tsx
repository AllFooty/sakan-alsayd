'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function LoadingScreen() {
  const t = useTranslations('common');

  return (
    <div className="flex flex-col items-center justify-center py-32 gap-3">
      <Loader2 size={32} className="animate-spin text-coral" />
      <p className="text-sm text-gray-500">{t('loading')}</p>
    </div>
  );
}

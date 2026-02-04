'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLocale = () => {
    const newLocale = locale === 'ar' ? 'en' : 'ar';
    // Replace the current locale in the pathname with the new one
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  return (
    <button
      onClick={toggleLocale}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl',
        'bg-cream hover:bg-cream-dark transition-colors duration-200',
        'text-navy font-medium text-sm'
      )}
      aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Globe className="w-4 h-4" />
      <span>{locale === 'ar' ? 'EN' : 'عربي'}</span>
    </button>
  );
}

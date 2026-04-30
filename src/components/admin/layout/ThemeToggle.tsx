'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme, type ThemeMode } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

const ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  system: Monitor,
  dark: Moon,
};

const ORDER: ThemeMode[] = ['light', 'system', 'dark'];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('admin.theme');

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="inline-flex items-center rounded-lg border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface-2)] p-0.5"
    >
      {ORDER.map((mode) => {
        const Icon = ICONS[mode];
        const active = theme === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setTheme(mode)}
            aria-label={t(mode)}
            aria-pressed={active}
            title={t(mode)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              active
                ? 'bg-coral text-white'
                : 'text-gray-500 dark:text-[var(--admin-text-muted)] hover:bg-gray-100 dark:hover:bg-[var(--admin-border)]',
            )}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}

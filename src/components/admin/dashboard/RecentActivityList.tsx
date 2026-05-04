'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations, useLocale } from 'next-intl';
import { UserPlus, UserMinus, UserCheck, ArrowRightCircle, RefreshCcw } from 'lucide-react';
import type { ActivityItem } from '@/app/api/admin/dashboard-activity/route';

const fetcher = async (url: string): Promise<{ items: ActivityItem[] }> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`activity fetch failed: ${res.status}`);
  return res.json();
};

// Locale-aware relative timestamp using the browser's Intl API. Stops at
// "yesterday" — older entries fall back to a plain locale date.
function formatRelative(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000); // negative for past
  const abs = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second');
  if (abs < 60 * 60) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 60 * 60 * 24) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 60 * 60 * 24 * 7) return rtf.format(Math.round(diffSec / 86400), 'day');

  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'en-US' : 'en-US', {
    // Western numerals per project rule, even on AR locale.
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Pick an icon hint for each known action. Unknown actions get a neutral
// refresh icon so the row still renders.
function actionIcon(action: string) {
  switch (action) {
    case 'resident.created':
    case 'resident.moved_in':
      return UserPlus;
    case 'resident.checked_out':
    case 'resident.checked_out_assignment':
      return UserMinus;
    case 'resident.updated':
      return UserCheck;
    case 'booking.converted_to_resident':
      return ArrowRightCircle;
    default:
      return RefreshCcw;
  }
}

// Resolve the entity to a detail-page link when we have one. Falls back to
// no link rather than guessing — better than a 404.
function entityHref(item: ActivityItem, locale: string): string | null {
  if (!item.entity_id) return null;
  switch (item.entity_type) {
    case 'resident':
      return `/${locale}/admin/residents/${item.entity_id}`;
    case 'booking_request':
      return `/${locale}/admin/bookings/${item.entity_id}`;
    default:
      return null;
  }
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();
  const Icon = actionIcon(item.action);
  const href = entityHref(item, locale);

  // Translation key is the dotted action (resolves through the nested
  // activityActions object). Use t.has() to avoid console-spamming on
  // un-translated future actions; fall back to the raw action string so
  // it's still visible.
  const actionKey = `activityActions.${item.action}`;
  const actionLabel = t.has(actionKey) ? t(actionKey) : item.action;

  const actor = item.actor_name ?? t('activityActorUnknown');
  const when = formatRelative(item.created_at, locale);

  const body = (
    <div className="flex items-start gap-3 py-3">
      <div className="w-9 h-9 rounded-full bg-coral/10 dark:bg-coral/20 text-coral flex items-center justify-center flex-shrink-0">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-navy dark:text-[var(--admin-text)]">
          <span className="font-medium">{actor}</span>{' '}
          <span className="text-gray-600 dark:text-[var(--admin-text-muted)]">{actionLabel}</span>
        </p>
        <p className="text-xs text-gray-400 dark:text-[var(--admin-text-subtle)] mt-0.5">{when}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block -mx-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-[var(--admin-surface-2)] transition-colors"
      >
        {body}
      </Link>
    );
  }
  return <div className="-mx-2 px-2">{body}</div>;
}

function ActivitySkeleton() {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-[var(--admin-border)]">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-start gap-3 py-3">
          <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-[var(--admin-surface-2)] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 bg-gray-200 dark:bg-[var(--admin-surface-2)] rounded animate-pulse" />
            <div className="h-3 w-1/4 bg-gray-200 dark:bg-[var(--admin-surface-2)] rounded animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function RecentActivityList() {
  const t = useTranslations('admin.dashboard');
  const { data, error, isLoading } = useSWR<{ items: ActivityItem[] }>(
    '/api/admin/dashboard-activity',
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 15_000,
    },
  );

  if (isLoading) return <ActivitySkeleton />;
  if (error) {
    return <p className="text-sm text-red-500" role="alert">{t('activityError')}</p>;
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <p className="text-gray-400 dark:text-[var(--admin-text-subtle)] text-sm">
        {t('noActivity')}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-[var(--admin-border)]">
      {items.map((item) => (
        <li key={item.id}>
          <ActivityRow item={item} />
        </li>
      ))}
    </ul>
  );
}

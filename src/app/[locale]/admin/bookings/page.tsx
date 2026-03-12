'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/hooks';
import BookingsList from '@/components/admin/bookings/BookingsList';

export default function BookingsPage() {
  const t = useTranslations('admin.bookings');
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      <BookingsList />
    </div>
  );
}

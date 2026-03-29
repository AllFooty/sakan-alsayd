'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/hooks';
import BookingsList from '@/components/admin/bookings/BookingsList';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';

export default function BookingsPage() {
  const t = useTranslations('admin.bookings');
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
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

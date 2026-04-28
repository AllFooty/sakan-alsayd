'use client';

import { use } from 'react';
import { useAuth } from '@/lib/auth/hooks';
import BookingDetail from '@/components/admin/bookings/BookingDetail';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';

export default function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const { loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return <BookingDetail bookingId={id} />;
}

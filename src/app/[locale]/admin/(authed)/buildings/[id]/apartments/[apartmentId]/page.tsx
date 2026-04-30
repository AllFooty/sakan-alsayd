'use client';

import { use } from 'react';
import ApartmentDetail from '@/components/admin/buildings/ApartmentDetail';

export default function ApartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string; apartmentId: string; locale: string }>;
}) {
  const { id: buildingId, apartmentId } = use(params);
  return <ApartmentDetail buildingId={buildingId} apartmentId={apartmentId} />;
}

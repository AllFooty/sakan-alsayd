'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { DoorOpen } from 'lucide-react';
import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import EmptyState from '@/components/admin/shared/EmptyState';
import RoomForm, {
  type RoomFormValues,
} from '@/components/admin/buildings/RoomForm';

interface RoomApi {
  id: string;
  building_id: string;
  room_number: string | null;
  floor: number | null;
  room_type: string;
  bathroom_type: string;
  capacity: number;
  occupancy_mode: 'private' | 'shared';
  monthly_price: number;
  discounted_price: number | null;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  notes: string | null;
  building: {
    id: string;
    city_en: string;
    city_ar: string;
    neighborhood_en: string;
    neighborhood_ar: string;
  } | null;
}

const ROOM_TYPES = ['single', 'double', 'triple', 'suite'] as const;
const BATHROOM_TYPES = [
  'shared',
  'shared-a',
  'shared-b',
  'shared-balcony',
  'private',
  'private-balcony',
  'private-two-rooms',
  'master',
  'master-a',
  'master-b',
  'master-balcony',
  'suite',
] as const;

type RoomType = (typeof ROOM_TYPES)[number];
type BathroomType = (typeof BATHROOM_TYPES)[number];

function asRoomType(v: string): RoomType {
  return (ROOM_TYPES as readonly string[]).includes(v) ? (v as RoomType) : 'single';
}
function asBathroomType(v: string): BathroomType {
  return (BATHROOM_TYPES as readonly string[]).includes(v)
    ? (v as BathroomType)
    : 'shared';
}

export default function EditRoomPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string; locale: string }>;
}) {
  const { id: buildingId, roomId } = use(params);
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const t = useTranslations('admin.buildings.roomForm');

  // Edit allowed for admin tier + branch_manager (the API enforces scoping
  // for branch_manager via the building assignment table).
  const canEdit =
    !!profile &&
    (profile.role === 'super_admin' ||
      profile.role === 'deputy_general_manager' ||
      profile.role === 'branch_manager');
  // Delete is admin-tier only.
  const canDelete =
    !!profile &&
    (profile.role === 'super_admin' || profile.role === 'deputy_general_manager');

  const [initial, setInitial] = useState<Partial<RoomFormValues> | null>(null);
  const [buildingLabel, setBuildingLabel] = useState<string | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!authLoading && profile && !canEdit) {
      router.replace(`/${locale}/admin/buildings/${buildingId}`);
    }
  }, [authLoading, profile, canEdit, router, locale, buildingId]);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/rooms/${roomId}`);
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        const r: RoomApi = json.data;

        // Defensive: if the room belongs to a different building, treat as
        // not-found rather than rendering a misleading edit form.
        if (r.building_id !== buildingId) {
          setNotFound(true);
          return;
        }

        setInitial({
          room_number: r.room_number ?? '',
          floor: r.floor !== null ? String(r.floor) : '',
          room_type: asRoomType(r.room_type),
          bathroom_type: asBathroomType(r.bathroom_type),
          capacity: String(r.capacity),
          occupancy_mode: r.occupancy_mode === 'shared' ? 'shared' : 'private',
          monthly_price: String(r.monthly_price),
          discounted_price:
            r.discounted_price !== null ? String(r.discounted_price) : '',
          status: r.status,
          notes: r.notes ?? '',
        });
        if (r.building) {
          setBuildingLabel(
            isArabic
              ? `${r.building.neighborhood_ar} — ${r.building.city_ar}`
              : `${r.building.neighborhood_en} — ${r.building.city_en}`
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load room:', err);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [roomId, buildingId, canEdit, isArabic]);

  if (authLoading || loading) return <LoadingScreen />;

  if (!canEdit) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState
          icon={DoorOpen}
          title={t('forbidden.title')}
          description={t('forbidden.description')}
        />
      </div>
    );
  }

  if (notFound || !initial) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState
          icon={DoorOpen}
          title={t('notFound.title')}
          description={t('notFound.description')}
        />
      </div>
    );
  }

  return (
    <RoomForm
      mode="edit"
      buildingId={buildingId}
      buildingLabel={buildingLabel}
      roomId={roomId}
      initial={initial}
      canDelete={canDelete}
    />
  );
}

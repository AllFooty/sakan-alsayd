'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bed, Wrench, Clock, LayoutGrid } from 'lucide-react';
import EmptyState from '@/components/admin/shared/EmptyState';
import RoomDetailPanel from './RoomDetailPanel';
import { cn } from '@/lib/utils';

export interface FloorMapRoom {
  id: string;
  room_number: string | null;
  floor: number | null;
  room_type: string;
  capacity: number;
  occupancy_mode: 'private' | 'shared';
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  active_assignments_count: number;
}

interface BuildingFloorMapProps {
  rooms: FloorMapRoom[];
}

type TileTone = 'vacant' | 'occupied' | 'maintenance' | 'reserved';

const toneStyles: Record<TileTone, { card: string; tile: string; text: string }> = {
  vacant: {
    card: 'bg-emerald-500',
    tile: 'bg-emerald-500 text-white',
    text: 'text-emerald-700',
  },
  occupied: {
    card: 'bg-coral',
    tile: 'bg-coral text-white',
    text: 'text-coral',
  },
  maintenance: {
    card: 'bg-amber-500',
    tile: 'bg-amber-500 text-white',
    text: 'text-amber-700',
  },
  reserved: {
    card: 'bg-navy',
    tile: 'bg-navy text-white',
    text: 'text-navy',
  },
};

function toneIcon(tone: TileTone) {
  switch (tone) {
    case 'maintenance':
      return Wrench;
    case 'reserved':
      return Clock;
    default:
      return Bed;
  }
}

function getRoomTone(room: FloorMapRoom): TileTone {
  if (room.status === 'maintenance') return 'maintenance';
  if (room.status === 'reserved') return 'reserved';
  if (room.occupancy_mode === 'private') {
    return room.active_assignments_count > 0 ? 'occupied' : 'vacant';
  }
  return room.active_assignments_count >= room.capacity ? 'occupied' : 'vacant';
}

function getRoomBuckets(room: FloorMapRoom): {
  occupied: number;
  vacant: number;
  unavailable: number;
} {
  if (room.status === 'maintenance' || room.status === 'reserved') {
    return { occupied: 0, vacant: 0, unavailable: room.capacity };
  }
  if (room.occupancy_mode === 'private') {
    if (room.active_assignments_count > 0) {
      return { occupied: room.capacity, vacant: 0, unavailable: 0 };
    }
    return { occupied: 0, vacant: room.capacity, unavailable: 0 };
  }
  const occupied = Math.min(room.active_assignments_count, room.capacity);
  return { occupied, vacant: room.capacity - occupied, unavailable: 0 };
}

interface FloorGroup {
  key: string;
  floor: number | null;
  rooms: FloorMapRoom[];
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  unavailableBeds: number;
}

function groupByFloor(rooms: FloorMapRoom[]): FloorGroup[] {
  const map = new Map<string, FloorGroup>();
  for (const r of rooms) {
    const key = r.floor === null ? '__unassigned' : String(r.floor);
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        floor: r.floor,
        rooms: [],
        totalBeds: 0,
        occupiedBeds: 0,
        vacantBeds: 0,
        unavailableBeds: 0,
      };
      map.set(key, group);
    }
    group.rooms.push(r);
    const buckets = getRoomBuckets(r);
    group.totalBeds += r.capacity;
    group.occupiedBeds += buckets.occupied;
    group.vacantBeds += buckets.vacant;
    group.unavailableBeds += buckets.unavailable;
  }
  const groups = Array.from(map.values());
  // Numbered floors descend (top floor first); unassigned trails.
  groups.sort((a, b) => {
    if (a.floor === null && b.floor === null) return 0;
    if (a.floor === null) return 1;
    if (b.floor === null) return -1;
    return b.floor - a.floor;
  });
  for (const g of groups) {
    g.rooms.sort((x, y) => {
      const xNum = x.room_number ?? '';
      const yNum = y.room_number ?? '';
      return xNum.localeCompare(yNum, 'en', { numeric: true });
    });
  }
  return groups;
}

export default function BuildingFloorMap({ rooms }: BuildingFloorMapProps) {
  const t = useTranslations('admin.buildings.floorMap');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const totals = useMemo(() => {
    let totalBeds = 0;
    let occupiedBeds = 0;
    let unavailableBeds = 0;
    for (const r of rooms) {
      totalBeds += r.capacity;
      const buckets = getRoomBuckets(r);
      occupiedBeds += buckets.occupied;
      unavailableBeds += buckets.unavailable;
    }
    const rentableBeds = totalBeds - unavailableBeds;
    const vacantBeds = rentableBeds - occupiedBeds;
    const vacancyPct =
      rentableBeds > 0 ? Math.round((vacantBeds / rentableBeds) * 100) : 0;
    return { totalBeds, occupiedBeds, vacantBeds, unavailableBeds, vacancyPct };
  }, [rooms]);

  const groups = useMemo(() => groupByFloor(rooms), [rooms]);

  if (selectedRoomId) {
    return (
      <RoomDetailPanel
        roomId={selectedRoomId}
        onBack={() => setSelectedRoomId(null)}
      />
    );
  }

  if (rooms.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title={t('emptyTitle')}
        description={t('emptyDescription')}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryStat label={t('summaryTotal')} value={totals.totalBeds} />
          <SummaryStat
            label={t('summaryOccupied')}
            value={totals.occupiedBeds}
            tone="occupied"
          />
          <SummaryStat
            label={t('summaryVacant')}
            value={totals.vacantBeds}
            tone="vacant"
          />
          <SummaryStat
            label={t('summaryPercent')}
            value={totals.vacancyPct}
            suffix="%"
            tone="vacant"
          />
        </div>
      </div>

      <Legend />

      <div className="space-y-4">
        {groups.map((group) => {
          const floorLabel =
            group.floor === null
              ? t('floorUnassigned')
              : t('floorLabel', { floor: group.floor });
          const summary = t('floorSummary', {
            vacant: group.vacantBeds,
            total: group.totalBeds,
          });
          return (
            <section
              key={group.key}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <h3 className="text-sm font-semibold text-navy">{floorLabel}</h3>
                <p className="text-xs text-gray-500 tabular-nums">{summary}</p>
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 sm:p-5">
                {group.rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onSelect={() => setSelectedRoomId(room.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">{t('clickHint')}</p>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: TileTone;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-bold tabular-nums',
          tone ? toneStyles[tone].text : 'text-navy'
        )}
      >
        {value}
        {suffix ? <span className="text-base font-semibold ms-0.5">{suffix}</span> : null}
      </p>
    </div>
  );
}

function Legend() {
  const t = useTranslations('admin.buildings.floorMap.legend');
  const items: Array<{ tone: TileTone; label: string }> = [
    { tone: 'vacant', label: t('vacant') },
    { tone: 'occupied', label: t('occupied') },
    { tone: 'maintenance', label: t('maintenance') },
    { tone: 'reserved', label: t('reserved') },
  ];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        {t('title')}
      </p>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map(({ tone, label }) => {
          const Icon = toneIcon(tone);
          return (
            <li key={tone} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex items-center justify-center w-6 h-6 rounded-md',
                  toneStyles[tone].tile
                )}
              >
                <Icon size={12} />
              </span>
              <span className="text-xs text-gray-700">{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RoomCard({
  room,
  onSelect,
}: {
  room: FloorMapRoom;
  onSelect: () => void;
}) {
  const t = useTranslations('admin.buildings.floorMap');
  const tStatus = useTranslations('admin.buildings.roomStatus');
  const tType = useTranslations('rooms.types');
  const tMode = useTranslations('rooms.occupancyMode');

  const tone = getRoomTone(room);
  const buckets = getRoomBuckets(room);
  const isShared = room.occupancy_mode === 'shared';
  const isUnavailable = buckets.unavailable > 0;
  const tiles = renderTiles(room, tone);

  const headerLabel = room.room_number
    ? t('roomLabel', { number: room.room_number })
    : t('roomUnnumbered');

  const statusLabel = tStatus(room.status);
  const ariaLabel = t('cardAriaLabel', {
    room: headerLabel,
    type: tType(room.room_type),
    mode: tMode(room.occupancy_mode),
    occupied: buckets.occupied,
    vacant: buckets.vacant,
    capacity: room.capacity,
    status: statusLabel,
  });

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={ariaLabel}
      className="group cursor-pointer text-start bg-white border border-gray-200 rounded-lg p-3 hover:border-coral/60 hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy truncate">{headerLabel}</p>
          <p className="text-[11px] text-gray-500 truncate">
            {tType(room.room_type)} · {tMode(room.occupancy_mode)}
          </p>
        </div>
        <span
          className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap',
            tone === 'vacant' && 'bg-emerald-50 text-emerald-700',
            tone === 'occupied' && 'bg-coral/10 text-coral',
            tone === 'maintenance' && 'bg-amber-50 text-amber-700',
            tone === 'reserved' && 'bg-navy/10 text-navy'
          )}
        >
          {statusLabel}
        </span>
      </div>

      {tiles}

      <p className="mt-2 text-[11px] text-gray-500 tabular-nums">
        {isUnavailable
          ? t('cardCapacityUnavailable', { count: room.capacity })
          : isShared
            ? t('cardCapacityShared', {
                occupied: buckets.occupied,
                capacity: room.capacity,
              })
            : t('cardCapacityPrivate', { count: room.capacity })}
      </p>
    </button>
  );
}

function renderTiles(room: FloorMapRoom, tone: TileTone): React.ReactElement {
  const isShared = room.occupancy_mode === 'shared';
  if (!isShared) {
    const Icon = toneIcon(tone);
    return (
      <div
        className={cn(
          'flex items-center justify-center h-14 rounded-md gap-1.5',
          toneStyles[tone].tile
        )}
        aria-hidden="true"
      >
        <Icon size={18} />
        {room.capacity > 1 && (
          <span className="text-xs font-semibold tabular-nums">×{room.capacity}</span>
        )}
      </div>
    );
  }

  const buckets = getRoomBuckets(room);
  const wholeRoomTone =
    room.status === 'maintenance' || room.status === 'reserved' ? tone : null;

  const tiles: TileTone[] = [];
  if (wholeRoomTone) {
    for (let i = 0; i < room.capacity; i += 1) tiles.push(wholeRoomTone);
  } else {
    for (let i = 0; i < buckets.occupied; i += 1) tiles.push('occupied');
    for (let i = 0; i < buckets.vacant; i += 1) tiles.push('vacant');
  }

  return (
    <div className="flex flex-wrap gap-1.5" aria-hidden="true">
      {tiles.map((tileTone, i) => {
        const Icon = toneIcon(tileTone);
        return (
          <div
            key={i}
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-md',
              toneStyles[tileTone].tile
            )}
          >
            <Icon size={14} />
          </div>
        );
      })}
    </div>
  );
}

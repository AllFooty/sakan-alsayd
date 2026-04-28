// Shared bed-counting domain rules for the Occupancy dashboard and the
// per-building Floor Map. Keep this file as the single source of truth —
// drift between the API aggregate and the UI tile renderer caused
// inconsistent vacancy% across views in the first cut.
//
// Rules (per migration 021 + room status semantics):
//   - capacity ≥ 1 always; defaults to 1
//   - occupancy_mode 'private' = whole-room contract → any active
//     assignment fills the whole room
//   - occupancy_mode 'shared'  = per-bed contracts → occupied = min(active, capacity)
//   - room.status 'maintenance' or 'reserved' overrides the whole room and
//     blanks ALL beds for that tone (those beds are not counted as
//     "rentable" — they're temporarily out of inventory)

export type BedStatus = 'vacant' | 'occupied' | 'maintenance' | 'reserved';

export interface RoomOccupancyInput {
  capacity: number | null | undefined;
  occupancy_mode: 'private' | 'shared' | null | undefined;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  active_assignments_count: number;
}

export interface RoomBuckets {
  occupied: number;
  vacant: number;
  unavailable: number; // maintenance + reserved
  capacity: number;
}

export interface BedTotals {
  total_beds: number;
  vacant_beds: number;
  occupied_beds: number;
  maintenance_beds: number;
  reserved_beds: number;
}

export function emptyBedTotals(): BedTotals {
  return {
    total_beds: 0,
    vacant_beds: 0,
    occupied_beds: 0,
    maintenance_beds: 0,
    reserved_beds: 0,
  };
}

export function normalizeCapacity(c: number | null | undefined): number {
  if (typeof c !== 'number' || !Number.isFinite(c) || c < 1) return 1;
  return Math.floor(c);
}

export function getRoomBuckets(room: RoomOccupancyInput): RoomBuckets {
  const capacity = normalizeCapacity(room.capacity);
  if (room.status === 'maintenance' || room.status === 'reserved') {
    return { occupied: 0, vacant: 0, unavailable: capacity, capacity };
  }
  if (room.occupancy_mode === 'shared') {
    const occupied = Math.min(Math.max(0, room.active_assignments_count), capacity);
    return { occupied, vacant: capacity - occupied, unavailable: 0, capacity };
  }
  // private (default)
  if (room.active_assignments_count > 0) {
    return { occupied: capacity, vacant: 0, unavailable: 0, capacity };
  }
  return { occupied: 0, vacant: capacity, unavailable: 0, capacity };
}

export function computeBedStatuses(room: RoomOccupancyInput): BedStatus[] {
  const capacity = normalizeCapacity(room.capacity);
  if (room.status === 'maintenance') return Array(capacity).fill('maintenance');
  if (room.status === 'reserved') return Array(capacity).fill('reserved');
  const buckets = getRoomBuckets(room);
  return [
    ...Array(buckets.occupied).fill('occupied' as BedStatus),
    ...Array(buckets.vacant).fill('vacant' as BedStatus),
  ];
}

export function addBucketsToTotals(totals: BedTotals, room: RoomOccupancyInput): void {
  const buckets = getRoomBuckets(room);
  totals.total_beds += buckets.capacity;
  totals.occupied_beds += buckets.occupied;
  totals.vacant_beds += buckets.vacant;
  if (buckets.unavailable > 0) {
    if (room.status === 'maintenance') totals.maintenance_beds += buckets.unavailable;
    else if (room.status === 'reserved') totals.reserved_beds += buckets.unavailable;
  }
}

// Vacancy % is always computed against RENTABLE beds (total minus
// maintenance and reserved). A building with 4 of 10 beds in maintenance
// shouldn't read "30% empty" — those 4 beds aren't on the market.
export function rentableBeds(totals: BedTotals): number {
  return Math.max(
    0,
    totals.total_beds - totals.maintenance_beds - totals.reserved_beds
  );
}

export function vacancyPctOfRentable(totals: BedTotals): number {
  const rentable = rentableBeds(totals);
  if (rentable === 0) return 0;
  return (totals.vacant_beds / rentable) * 100;
}

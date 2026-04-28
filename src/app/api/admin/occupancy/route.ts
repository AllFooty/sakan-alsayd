import { NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';
import {
  type BedStatus,
  type BedTotals,
  type RoomOccupancyInput,
  addBucketsToTotals,
  computeBedStatuses,
  emptyBedTotals,
  normalizeCapacity,
} from '@/lib/rooms/occupancy';

interface BuildingRow {
  id: string;
  slug: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
  sort_order: number;
}

interface RoomRow {
  id: string;
  building_id: string;
  room_number: string | null;
  floor: number | null;
  capacity: number;
  occupancy_mode: 'private' | 'shared';
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

interface AssignmentCountRow {
  room_id: string;
}

interface RoomOccupancy {
  id: string;
  room_number: string | null;
  floor: number | null;
  capacity: number;
  bed_statuses: BedStatus[];
}

export async function GET() {
  try {
    const auth = await authenticateApiRequest(
      'branch_manager',
      'maintenance_manager',
      'transportation_manager',
      'finance_manager',
      'maintenance_staff',
      'transportation_staff',
      'supervision_staff',
      'finance_staff'
    );
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    let assignedIds: string[] | null = null;
    if (!hasAdminAccess(profile.role)) {
      assignedIds = await getAssignedBuildingIds(profile.id);
      if (assignedIds.length === 0) {
        return NextResponse.json({ totals: emptyBedTotals(), buildings: [] });
      }
    }

    let buildingsQuery = supabase
      .from('buildings')
      .select(
        'id, slug, city_en, city_ar, neighborhood_en, neighborhood_ar, sort_order'
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (assignedIds) {
      buildingsQuery = buildingsQuery.in('id', assignedIds);
    }

    const { data: buildingsData, error: buildingsErr } = await buildingsQuery;
    if (buildingsErr) {
      console.error('Error fetching buildings for occupancy:', buildingsErr);
      return NextResponse.json({ error: 'Failed to load occupancy' }, { status: 500 });
    }

    const buildings = (buildingsData || []) as BuildingRow[];
    if (buildings.length === 0) {
      return NextResponse.json({ totals: emptyBedTotals(), buildings: [] });
    }

    const buildingIds = buildings.map((b) => b.id);

    const { data: roomsData, error: roomsErr } = await supabase
      .from('rooms')
      .select('id, building_id, room_number, floor, capacity, occupancy_mode, status')
      .in('building_id', buildingIds);
    if (roomsErr) {
      console.error('Error fetching rooms for occupancy:', roomsErr);
      return NextResponse.json({ error: 'Failed to load occupancy' }, { status: 500 });
    }
    const rooms = (roomsData || []) as RoomRow[];

    let activeAssignmentsByRoom = new Map<string, number>();
    if (rooms.length > 0) {
      const roomIds = rooms.map((r) => r.id);
      const { data: assignData, error: assignErr } = await supabase
        .from('room_assignments')
        .select('room_id')
        .eq('status', 'active')
        .in('room_id', roomIds);
      if (assignErr) {
        console.error('Error fetching room assignments for occupancy:', assignErr);
        return NextResponse.json({ error: 'Failed to load occupancy' }, { status: 500 });
      }
      activeAssignmentsByRoom = new Map<string, number>();
      for (const row of (assignData || []) as AssignmentCountRow[]) {
        activeAssignmentsByRoom.set(
          row.room_id,
          (activeAssignmentsByRoom.get(row.room_id) ?? 0) + 1
        );
      }
    }

    const perBuilding = new Map<string, BedTotals>();
    const roomsByBuilding = new Map<string, RoomOccupancy[]>();
    for (const id of buildingIds) {
      perBuilding.set(id, emptyBedTotals());
      roomsByBuilding.set(id, []);
    }

    for (const room of rooms) {
      const stats = perBuilding.get(room.building_id);
      const roomList = roomsByBuilding.get(room.building_id);
      if (!stats || !roomList) continue;
      const input: RoomOccupancyInput = {
        capacity: room.capacity,
        occupancy_mode: room.occupancy_mode,
        status: room.status,
        active_assignments_count: activeAssignmentsByRoom.get(room.id) ?? 0,
      };
      addBucketsToTotals(stats, input);
      roomList.push({
        id: room.id,
        room_number: room.room_number,
        floor: room.floor,
        capacity: normalizeCapacity(room.capacity),
        bed_statuses: computeBedStatuses(input),
      });
    }

    const totals = emptyBedTotals();
    const buildingsOut = buildings.map((b) => {
      const stats = perBuilding.get(b.id) ?? emptyBedTotals();
      const roomList = roomsByBuilding.get(b.id) ?? [];
      totals.total_beds += stats.total_beds;
      totals.vacant_beds += stats.vacant_beds;
      totals.occupied_beds += stats.occupied_beds;
      totals.maintenance_beds += stats.maintenance_beds;
      totals.reserved_beds += stats.reserved_beds;
      // Sort rooms: floor desc (top floor first), then room_number asc; nulls trailing.
      const sortedRooms = [...roomList].sort((a, b) => {
        const af = a.floor ?? Number.NEGATIVE_INFINITY;
        const bf = b.floor ?? Number.NEGATIVE_INFINITY;
        if (af !== bf) return bf - af;
        const an = a.room_number ?? '';
        const bn = b.room_number ?? '';
        return an.localeCompare(bn, 'en', { numeric: true });
      });
      return {
        id: b.id,
        slug: b.slug,
        building_number: b.sort_order ?? null,
        city_en: b.city_en,
        city_ar: b.city_ar,
        neighborhood_en: b.neighborhood_en,
        neighborhood_ar: b.neighborhood_ar,
        ...stats,
        rooms: sortedRooms,
      };
    });

    return NextResponse.json({ totals, buildings: buildingsOut });
  } catch (error) {
    console.error('Occupancy dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

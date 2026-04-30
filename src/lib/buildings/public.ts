import { createClient } from '@supabase/supabase-js';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';

export type RoomTypeKey = 'single' | 'double' | 'triple' | 'suite';
export type BathroomTypeKey =
  | 'shared'
  | 'shared-a'
  | 'shared-b'
  | 'shared-balcony'
  | 'private'
  | 'private-balcony'
  | 'private-two-rooms'
  | 'master'
  | 'master-a'
  | 'master-b'
  | 'master-balcony'
  | 'suite';

export interface PublicLandmark {
  id: string;
  name: string;
  nameAr: string;
  distance: string;
  distanceAr: string;
}

export interface PublicRoomPrice {
  type: RoomTypeKey;
  bathroomType: BathroomTypeKey;
  monthlyPrice: number;
  discountedPrice?: number;
  // Distinct apartments in the building that contain at least one room of
  // this (type, bathroom) tier. Used by public room cards to surface
  // "available across N apartments" context.
  apartmentCount: number;
}

export interface PublicApartmentSummary {
  // Headline stats for the building's apartment layer. Renders as
  // "X apartments across Y floors" on the public building page header.
  count: number;
  floors: number;
  // Counts of apartments with shared facilities — `withKitchen === count`
  // means the page can confidently say "all apartments have a kitchen".
  withKitchen: number;
  withLivingRoom: number;
  // Distinct bedroom counts (rooms per apartment) across the building.
  // Sorted ascending and capped to keep the header tag list readable.
  bedroomCounts: number[];
}

export interface PublicBuilding {
  id: string;
  city: string;
  cityAr: string;
  neighborhood: string;
  neighborhoodAr: string;
  description: string;
  descriptionAr: string;
  coverImage: string;
  mapUrl: string;
  nearbyLandmarks: PublicLandmark[];
  roomPrices: PublicRoomPrice[];
  apartmentSummary: PublicApartmentSummary;
  isPlaceholder: boolean;
}

export interface PublicCity {
  name: string;
  nameAr: string;
}

export const PUBLIC_BUILDINGS_TAG = 'public-buildings';
const REVALIDATE_SECONDS = 60;

// Call from any admin mutation that changes a row the public site reads
// from `buildings` or `rooms` (create / edit / soft-delete / room price /
// landmarks / cover_image). Drops the unstable_cache entry so the next
// public render fetches fresh data instead of waiting up to 60s.
//
// Next 16 made revalidateTag's second arg required. For unstable_cache
// entries the profile is ignored — the tag is purged regardless and the
// next call recomputes under the cached function's own revalidate window.
//
// We also call revalidatePath for the two route trees that render this
// data: tag invalidation alone refreshes the unstable_cache entry, but on
// Cloudflare Workers / OpenNext the route-level full-page cache is a
// separate layer and may serve stale HTML until its own revalidate window
// elapses. Path revalidation evicts that route cache too.
export function revalidatePublicBuildings(): void {
  revalidateTag(PUBLIC_BUILDINGS_TAG, 'max');
  revalidatePath('/[locale]/buildings/[id]', 'page');
  revalidatePath('/[locale]', 'layout');
}

function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

interface BuildingRow {
  id: string;
  slug: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
  description_en: string;
  description_ar: string;
  cover_image: string | null;
  map_url: string | null;
  landmarks: unknown;
  is_placeholder: boolean;
  sort_order: number;
}

interface RoomRow {
  building_id: string;
  apartment_id: string;
  room_type: RoomTypeKey;
  bathroom_type: BathroomTypeKey;
  monthly_price: string | number;
  discounted_price: string | number | null;
}

interface ApartmentRow {
  id: string;
  building_id: string;
  floor: number;
  has_kitchen: boolean;
  has_living_room: boolean;
}

interface RawLandmark {
  name_en?: unknown;
  name_ar?: unknown;
  distance_en?: unknown;
  distance_ar?: unknown;
}

function parseLandmarks(raw: unknown): PublicLandmark[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index): PublicLandmark => {
    const item = (entry ?? {}) as RawLandmark;
    return {
      id: String(index),
      name: typeof item.name_en === 'string' ? item.name_en : '',
      nameAr: typeof item.name_ar === 'string' ? item.name_ar : '',
      distance: typeof item.distance_en === 'string' ? item.distance_en : '',
      distanceAr: typeof item.distance_ar === 'string' ? item.distance_ar : '',
    };
  });
}

function resolveCoverImage(slug: string, coverImage: string | null): string {
  if (coverImage && coverImage.length > 0) return coverImage;
  return `/images/locations/${slug}.jpg`;
}

function aggregateRoomPrices(rooms: RoomRow[]): PublicRoomPrice[] {
  const cheapestByTier = new Map<string, RoomRow>();
  // Track distinct apartment IDs per tier so the public card can show
  // "available across N apartments". Aggregation happens alongside the
  // cheapest-price lookup to avoid a second pass.
  const apartmentSetByTier = new Map<string, Set<string>>();
  for (const room of rooms) {
    const key = `${room.room_type}::${room.bathroom_type}`;
    const existing = cheapestByTier.get(key);
    if (!existing || Number(room.monthly_price) < Number(existing.monthly_price)) {
      cheapestByTier.set(key, room);
    }
    let aptSet = apartmentSetByTier.get(key);
    if (!aptSet) {
      aptSet = new Set<string>();
      apartmentSetByTier.set(key, aptSet);
    }
    if (room.apartment_id) aptSet.add(room.apartment_id);
  }
  return Array.from(cheapestByTier.values()).map((room) => {
    const key = `${room.room_type}::${room.bathroom_type}`;
    return {
      type: room.room_type,
      bathroomType: room.bathroom_type,
      monthlyPrice: Number(room.monthly_price),
      discountedPrice:
        room.discounted_price !== null && room.discounted_price !== undefined
          ? Number(room.discounted_price)
          : undefined,
      apartmentCount: apartmentSetByTier.get(key)?.size ?? 0,
    };
  });
}

const MAX_BEDROOM_TAGS = 4;

function aggregateApartmentSummary(
  apartments: ApartmentRow[],
  rooms: RoomRow[]
): PublicApartmentSummary {
  if (apartments.length === 0) {
    return {
      count: 0,
      floors: 0,
      withKitchen: 0,
      withLivingRoom: 0,
      bedroomCounts: [],
    };
  }
  const floors = new Set<number>();
  let withKitchen = 0;
  let withLivingRoom = 0;
  for (const a of apartments) {
    floors.add(a.floor);
    if (a.has_kitchen) withKitchen += 1;
    if (a.has_living_room) withLivingRoom += 1;
  }

  // Bedroom counts: rooms per apartment, distinct + sorted ascending. Capped
  // at MAX_BEDROOM_TAGS so the page header stays readable on mobile when a
  // building has unusually varied apartment sizes.
  const roomsByApartment = new Map<string, number>();
  for (const r of rooms) {
    if (!r.apartment_id) continue;
    roomsByApartment.set(r.apartment_id, (roomsByApartment.get(r.apartment_id) ?? 0) + 1);
  }
  const distinctBedroomCounts = Array.from(new Set(roomsByApartment.values()))
    .sort((a, b) => a - b)
    .slice(0, MAX_BEDROOM_TAGS);

  return {
    count: apartments.length,
    floors: floors.size,
    withKitchen,
    withLivingRoom,
    bedroomCounts: distinctBedroomCounts,
  };
}

async function fetchPublicBuildings(): Promise<PublicBuilding[]> {
  const supabase = createPublicClient();

  const { data: buildings, error: buildingsError } = await supabase
    .from('buildings')
    .select(
      'id, slug, city_en, city_ar, neighborhood_en, neighborhood_ar, description_en, description_ar, cover_image, map_url, landmarks, is_placeholder, sort_order'
    )
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('neighborhood_en', { ascending: true });

  if (buildingsError) {
    throw new Error(`Failed to load public buildings: ${buildingsError.message}`);
  }
  const buildingRows = (buildings ?? []) as BuildingRow[];
  if (buildingRows.length === 0) {
    // Surfaces during `next build` and at runtime — public site silently
    // renders an empty grid otherwise, hiding seed/RLS/migration regressions.
    console.warn(
      '[public-buildings] 0 active buildings returned from Supabase. ' +
        'The public locations grid and /buildings/[id] static params will be empty.'
    );
    return [];
  }

  const buildingIds = buildingRows.map((b) => b.id);

  // Two parallel queries: rooms (for prices + per-apartment counts) and
  // apartments (for building-level summary stats). Apartments only renders
  // for is_active=true to match the anon RLS policy from migration 028.
  const [roomsRes, apartmentsRes] = await Promise.all([
    supabase
      .from('rooms')
      .select(
        'building_id, apartment_id, room_type, bathroom_type, monthly_price, discounted_price'
      )
      .in('building_id', buildingIds),
    supabase
      .from('apartments')
      .select('id, building_id, floor, has_kitchen, has_living_room')
      .in('building_id', buildingIds)
      .eq('is_active', true),
  ]);

  if (roomsRes.error) {
    throw new Error(`Failed to load public rooms: ${roomsRes.error.message}`);
  }
  if (apartmentsRes.error) {
    throw new Error(
      `Failed to load public apartments: ${apartmentsRes.error.message}`
    );
  }
  const apartmentRows = (apartmentsRes.data ?? []) as ApartmentRow[];

  // Drop rooms that belong to inactive apartments. The apartments query
  // already filters is_active=true, so a room whose apartment_id isn't in
  // the active set should be invisible on the public site — otherwise an
  // inactive apartment's rooms still drive the cheapest-price tier and
  // inflate the "available across N apartments" count.
  const activeApartmentIds = new Set(apartmentRows.map((a) => a.id));
  const roomRows = ((roomsRes.data ?? []) as RoomRow[]).filter((r) =>
    activeApartmentIds.has(r.apartment_id)
  );

  const roomsByBuilding = new Map<string, RoomRow[]>();
  for (const room of roomRows) {
    const list = roomsByBuilding.get(room.building_id) ?? [];
    list.push(room);
    roomsByBuilding.set(room.building_id, list);
  }

  const apartmentsByBuilding = new Map<string, ApartmentRow[]>();
  for (const apt of apartmentRows) {
    const list = apartmentsByBuilding.get(apt.building_id) ?? [];
    list.push(apt);
    apartmentsByBuilding.set(apt.building_id, list);
  }

  return buildingRows.map((row): PublicBuilding => {
    const buildingRooms = roomsByBuilding.get(row.id) ?? [];
    const buildingApartments = apartmentsByBuilding.get(row.id) ?? [];
    return {
      id: row.slug,
      city: row.city_en,
      cityAr: row.city_ar,
      neighborhood: row.neighborhood_en,
      neighborhoodAr: row.neighborhood_ar,
      description: row.description_en,
      descriptionAr: row.description_ar,
      coverImage: resolveCoverImage(row.slug, row.cover_image),
      mapUrl: row.map_url ?? '',
      nearbyLandmarks: parseLandmarks(row.landmarks),
      roomPrices: aggregateRoomPrices(buildingRooms),
      apartmentSummary: aggregateApartmentSummary(buildingApartments, buildingRooms),
      isPlaceholder: row.is_placeholder,
    };
  });
}

export const getPublicBuildings = unstable_cache(
  fetchPublicBuildings,
  ['public-buildings:list'],
  { revalidate: REVALIDATE_SECONDS, tags: [PUBLIC_BUILDINGS_TAG] }
);

export async function getPublicBuildingBySlug(
  slug: string
): Promise<PublicBuilding | null> {
  const buildings = await getPublicBuildings();
  return buildings.find((b) => b.id === slug) ?? null;
}

export async function getPublicCities(): Promise<PublicCity[]> {
  const buildings = await getPublicBuildings();
  const seen = new Set<string>();
  const cities: PublicCity[] = [];
  for (const b of buildings) {
    if (!seen.has(b.city)) {
      seen.add(b.city);
      cities.push({ name: b.city, nameAr: b.cityAr });
    }
  }
  return cities;
}

import { createClient } from '@supabase/supabase-js';
import { revalidateTag, unstable_cache } from 'next/cache';

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
export function revalidatePublicBuildings(): void {
  revalidateTag(PUBLIC_BUILDINGS_TAG, 'max');
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
  room_type: RoomTypeKey;
  bathroom_type: BathroomTypeKey;
  monthly_price: string | number;
  discounted_price: string | number | null;
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
  for (const room of rooms) {
    const key = `${room.room_type}::${room.bathroom_type}`;
    const existing = cheapestByTier.get(key);
    if (!existing || Number(room.monthly_price) < Number(existing.monthly_price)) {
      cheapestByTier.set(key, room);
    }
  }
  return Array.from(cheapestByTier.values()).map((room) => ({
    type: room.room_type,
    bathroomType: room.bathroom_type,
    monthlyPrice: Number(room.monthly_price),
    discountedPrice:
      room.discounted_price !== null && room.discounted_price !== undefined
        ? Number(room.discounted_price)
        : undefined,
  }));
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
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select('building_id, room_type, bathroom_type, monthly_price, discounted_price')
    .in('building_id', buildingIds);

  if (roomsError) {
    throw new Error(`Failed to load public rooms: ${roomsError.message}`);
  }
  const roomRows = (rooms ?? []) as RoomRow[];

  const roomsByBuilding = new Map<string, RoomRow[]>();
  for (const room of roomRows) {
    const list = roomsByBuilding.get(room.building_id) ?? [];
    list.push(room);
    roomsByBuilding.set(room.building_id, list);
  }

  return buildingRows.map((row): PublicBuilding => ({
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
    roomPrices: aggregateRoomPrices(roomsByBuilding.get(row.id) ?? []),
    isPlaceholder: row.is_placeholder,
  }));
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

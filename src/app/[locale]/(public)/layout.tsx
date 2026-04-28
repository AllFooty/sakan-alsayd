import { getPublicBuildings, getPublicCities } from '@/lib/buildings/public';
import { PublicBuildingsProvider } from '@/components/providers/PublicBuildingsProvider';

// Wraps the public marketing site (home, building detail, testimonials) with
// the buildings/cities provider. Lives in a route group so admin and admin
// login don't pay the Supabase round-trip or carry the data in their RSC
// payload.
//
// The fetch is unconditional even when NEXT_PUBLIC_SHOW_LOCATIONS is off:
// the contact form's city dropdown reads `cities` from the same provider
// regardless of whether the locations grid is rendered.
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Soft fallback: if Supabase is briefly unavailable or RLS regresses, we
  // still serve the marketing pages with empty arrays rather than crashing the
  // whole tree into error.tsx. Locations and city-dropdown UIs already handle
  // empty arrays gracefully — they just render no cards / no options.
  let buildings: Awaited<ReturnType<typeof getPublicBuildings>> = [];
  let cities: Awaited<ReturnType<typeof getPublicCities>> = [];
  try {
    [buildings, cities] = await Promise.all([
      getPublicBuildings(),
      getPublicCities(),
    ]);
  } catch (err) {
    console.error('[public layout] failed to fetch buildings/cities', err);
  }

  return (
    <PublicBuildingsProvider buildings={buildings} cities={cities}>
      {children}
    </PublicBuildingsProvider>
  );
}

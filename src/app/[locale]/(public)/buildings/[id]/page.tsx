import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Header, Footer } from '@/components/layout';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import BuildingRooms from '@/components/buildings/BuildingRooms';
import { getPublicBuildingBySlug, getPublicBuildings } from '@/lib/buildings/public';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

const showLocations = process.env.NEXT_PUBLIC_SHOW_LOCATIONS === 'true';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const isArabic = locale === 'ar';

  // Skip the Supabase round-trip when the locations feature is gated off —
  // the page body will notFound() anyway, no point fetching for metadata.
  if (!showLocations) {
    return {
      title: isArabic ? 'الصفحة غير موجودة | سكن السيد' : 'Page Not Found | Sakan Alsayd',
    };
  }

  const building = await getPublicBuildingBySlug(id);

  if (!building) {
    return {
      title: isArabic ? 'الصفحة غير موجودة | سكن السيد' : 'Page Not Found | Sakan Alsayd',
    };
  }

  const buildingName = isArabic ? building.neighborhoodAr : building.neighborhood;
  const cityName = isArabic ? building.cityAr : building.city;

  return {
    title: isArabic
      ? `الغرف المتاحة في ${buildingName} - ${cityName} | سكن السيد`
      : `Available Rooms in ${buildingName} - ${cityName} | Sakan Alsayd`,
    description: isArabic
      ? `اكتشفي الغرف المتاحة والأسعار في فرع ${buildingName} بـ${cityName}. غرف مفردة وثنائية وثلاثية وأجنحة مع جميع الخدمات.`
      : `Discover available rooms and prices at ${buildingName} in ${cityName}. Single, double, triple rooms and suites with all services included.`,
  };
}

export async function generateStaticParams() {
  // Don't prerender any building paths when the feature is gated off.
  if (!showLocations) return [];
  const buildings = await getPublicBuildings();
  return buildings.map((building) => ({
    id: building.id,
  }));
}

export default async function BuildingPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  if (!showLocations) {
    notFound();
  }

  const building = await getPublicBuildingBySlug(id);

  if (!building) {
    notFound();
  }

  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="pt-20 focus:outline-none">
        <BuildingRooms building={building} />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}

import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Header, Footer } from '@/components/layout';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import BuildingRooms from '@/components/buildings/BuildingRooms';
import { getLocationById, locations } from '@/data/locations';
import type { Metadata } from 'next';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const location = getLocationById(id);
  const isArabic = locale === 'ar';

  if (!location) {
    return {
      title: isArabic ? 'الصفحة غير موجودة | سكن السيد' : 'Page Not Found | Sakan Alsayd',
    };
  }

  const buildingName = isArabic ? location.neighborhoodAr : location.neighborhood;
  const cityName = isArabic ? location.cityAr : location.city;

  return {
    title: isArabic
      ? `الغرف المتاحة في ${buildingName} - ${cityName} | سكن السيد`
      : `Available Rooms in ${buildingName} - ${cityName} | Sakan Alsayd`,
    description: isArabic
      ? `اكتشفي الغرف المتاحة والأسعار في فرع ${buildingName} بـ${cityName}. غرف مفردة وثنائية وثلاثية مع جميع الخدمات.`
      : `Discover available rooms and prices at ${buildingName} in ${cityName}. Single, double, and triple rooms with all services included.`,
  };
}

export async function generateStaticParams() {
  return locations.map((location) => ({
    id: location.id,
  }));
}

export default async function BuildingPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const location = getLocationById(id);

  if (!location) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="pt-20">
        <BuildingRooms locationId={id} />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}

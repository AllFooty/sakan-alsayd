'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { User, Users, Users2, Bath, Info, ArrowLeft, ArrowRight, MapPin, DoorOpen, Home as HomeIcon, ChefHat } from 'lucide-react';
import { Card, Button, RoomImage } from '@/components/ui';
import type { PublicBuilding } from '@/lib/buildings/public';
import { formatPrice, cn } from '@/lib/utils';

// Lazy-load the booking wizard — keeps zod + react-hook-form out of the
// per-detail-page bundle until a room is actually selected. The `loading`
// overlay gives mobile users immediate feedback while the chunk arrives.
const BookingModal = dynamic(() => import('@/components/ui/BookingModal'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-10 h-10 rounded-full border-[3px] border-white/30 border-t-white animate-spin" />
    </div>
  ),
});

type RoomType = 'all' | 'single' | 'double' | 'triple' | 'suite';

interface BuildingRoomsProps {
  building: PublicBuilding;
}

const getRoomImage = (locationId: string, type: string, bathroomType: string): string => {
  const key = `${type}-${bathroomType}`;
  return `/images/locations/${locationId}/rooms/${key}.jpg`;
};

export default function BuildingRooms({ building }: BuildingRoomsProps) {
  const t = useTranslations('rooms');
  const tBuildings = useTranslations('buildings');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const [selectedType, setSelectedType] = useState<RoomType>('all');
  const [bookingPreselect, setBookingPreselect] = useState<{
    locationId: string;
    roomType: string;
    bathroomType: string;
  } | null>(null);

  const locationId = building.id;
  const roomPrices = building.roomPrices;
  const buildingName = isArabic ? building.neighborhoodAr : building.neighborhood;
  const cityName = isArabic ? building.cityAr : building.city;

  const availableTypes = new Set(roomPrices.map((room) => room.type));

  const allFilterTabs: { type: RoomType; label: string; icon: React.ReactNode }[] = [
    { type: 'all', label: isArabic ? 'الكل' : 'All', icon: null },
    { type: 'single', label: t('types.single'), icon: <User className="w-4 h-4" /> },
    { type: 'double', label: t('types.double'), icon: <Users className="w-4 h-4" /> },
    { type: 'triple', label: t('types.triple'), icon: <Users2 className="w-4 h-4" /> },
    { type: 'suite', label: t('types.suite'), icon: <DoorOpen className="w-4 h-4" /> },
  ];

  const filterTabs = allFilterTabs.filter(
    (tab) => tab.type === 'all' || availableTypes.has(tab.type)
  );

  const filteredRooms = selectedType === 'all'
    ? roomPrices
    : roomPrices.filter((room) => room.type === selectedType);

  const getRoomTypeName = (type: string) => {
    switch (type) {
      case 'single':
        return t('types.single');
      case 'double':
        return t('types.double');
      case 'triple':
        return t('types.triple');
      case 'suite':
        return t('types.suite');
      default:
        return type;
    }
  };

  const getBathroomName = (bathroomType: string) => {
    const key = `bathroom.${bathroomType}`;
    return t(key);
  };

  const BackArrow = isArabic ? ArrowRight : ArrowLeft;

  return (
    <section className="section-padding bg-white">
      <div className="container mx-auto">
        {/* Back Button */}
        <Link
          href={`/${locale}/#locations`}
          className="inline-flex items-center gap-2 text-coral hover:text-coral-dark transition-colors mb-8"
        >
          <BackArrow className="w-5 h-5" />
          <span className="font-medium">{tBuildings('backToLocations')}</span>
        </Link>

        {/* Building Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="flex items-center justify-center gap-2 text-navy/60 mb-4">
            <MapPin className="w-5 h-5 text-coral" />
            <span>{cityName}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-coral mb-4">
            {buildingName}
          </h1>
          <p className="text-navy/70">
            {tBuildings('pageTitle')}
          </p>
          {/* Apartment summary chips — only render when the building has been
              organized into apartments (count > 0). The kitchen tag shows
              only when ALL apartments have one, to avoid promising a feature
              the resident might not actually get. */}
          {building.apartmentSummary.count > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream text-navy/80">
                <HomeIcon className="w-3.5 h-3.5 text-coral" />
                {tBuildings('apartmentsSummary', {
                  apartments: building.apartmentSummary.count,
                  floors: building.apartmentSummary.floors,
                })}
              </span>
              {building.apartmentSummary.withKitchen ===
                building.apartmentSummary.count &&
                building.apartmentSummary.count > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream text-navy/80">
                    <ChefHat className="w-3.5 h-3.5 text-coral" />
                    {tBuildings('allApartmentsHaveKitchen')}
                  </span>
                )}
              {building.apartmentSummary.bedroomCounts.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream text-navy/80">
                  {tBuildings('bedroomMix', {
                    counts: building.apartmentSummary.bedroomCounts.join(', '),
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {filterTabs.map((tab) => (
            <button
              key={tab.type}
              onClick={() => setSelectedType(tab.type)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
                selectedType === tab.type
                  ? 'bg-coral text-white shadow-lg shadow-coral/25'
                  : 'bg-cream text-navy hover:bg-cream-dark'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Room Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <Card key={`${room.type}-${room.bathroomType}`} variant="elevated" hover className="overflow-hidden">
              {/* Room Image */}
              <div className="relative h-48">
                <RoomImage
                  src={getRoomImage(locationId, room.type, room.bathroomType)}
                  alt={`${getRoomTypeName(room.type)} - ${getBathroomName(room.bathroomType)}`}
                  placeholderSrc={`/images/locations/${locationId}/rooms/room-placeholder.jpg`}
                />
                {/* Room Type Badge */}
                <div className="absolute top-4 start-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                  <span className="text-sm font-semibold text-navy">
                    {getRoomTypeName(room.type)}
                  </span>
                </div>
              </div>

              <div className="p-6">
                {/* Room Details */}
                <div className="flex items-center gap-2 text-navy/60 mb-2">
                  <Bath className="w-4 h-4" />
                  <span className="text-sm">{getBathroomName(room.bathroomType)}</span>
                </div>
                {/* Apartment context — "available across N apartments" tells
                    students how flexible their placement is and confirms the
                    building's structure. Hidden when the data hasn't been
                    organized yet (count = 0). */}
                {room.apartmentCount > 0 && (
                  <div className="flex items-center gap-2 text-navy/60 mb-4">
                    <HomeIcon className="w-4 h-4" />
                    <span className="text-xs">
                      {tBuildings('roomCardApartmentContext', {
                        count: room.apartmentCount,
                      })}
                    </span>
                  </div>
                )}

                {/* Pricing */}
                <div className="space-y-2 mb-6">
                  {room.discountedPrice ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-coral">
                          {formatPrice(room.discountedPrice)}
                        </span>
                        <span className="text-navy/60 text-sm">{t('pricePerMonth')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-navy/40 line-through text-sm">
                          {formatPrice(room.monthlyPrice)}
                        </span>
                        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">
                          {t('monthlyDiscount')}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-coral">
                          {formatPrice(room.monthlyPrice)}
                        </span>
                        <span className="text-navy/60 text-sm">{t('pricePerMonth')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-navy/60 text-sm">
                          {t('semesterPrice')}: {formatPrice(room.monthlyPrice * 5)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* CTA */}
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    setBookingPreselect({
                      locationId,
                      roomType: room.type,
                      bathroomType: room.bathroomType,
                    });
                  }}
                >
                  {tBuildings('selectRoom')}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Info Notes */}
        <div className="mt-10 bg-cream rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-coral flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-navy font-medium">
                {t('deposit')}: <span className="text-coral">{t('depositAmount')}</span>
              </p>
              {building.roomPrices[0]?.discountedPrice ? (
                <p className="text-navy/60 text-sm">{t('yearlyDiscount')}</p>
              ) : (
                <>
                  <p className="text-navy/60 text-sm">{t('discountSemester')}</p>
                  <p className="text-navy/60 text-sm">{t('discountYearly')}</p>
                  <p className="text-navy/60 text-sm">{t('installmentOption')}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {bookingPreselect && (
        <BookingModal
          isOpen
          onClose={() => setBookingPreselect(null)}
          preselected={bookingPreselect}
        />
      )}
    </section>
  );
}

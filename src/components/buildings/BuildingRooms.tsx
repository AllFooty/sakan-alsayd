'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { User, Users, Users2, Bath, Info, ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { getLocationById } from '@/data/locations';
import { formatPrice, cn } from '@/lib/utils';

type RoomType = 'all' | 'single' | 'double' | 'triple';

interface BuildingRoomsProps {
  locationId: string;
}

// Map room configurations to image paths
const getRoomImage = (type: string, bathroomType: string): string => {
  const imageMap: Record<string, string> = {
    'single-shared': '/images/rooms/single-shared.jpg',
    'single-private': '/images/rooms/single-private.jpg',
    'single-master': '/images/rooms/single-master.jpg',
    'double-shared': '/images/rooms/double-shared.jpg',
    'double-private': '/images/rooms/double-private.jpg',
    'double-master': '/images/rooms/double-master.jpg',
    'triple-private': '/images/rooms/triple-private.jpg',
    'triple-shared': '/images/rooms/triple-private.jpg',
    'triple-master': '/images/rooms/triple-private.jpg',
  };

  const key = `${type}-${bathroomType}`;
  return imageMap[key] || '/images/rooms/room-placeholder.jpg';
};

export default function BuildingRooms({ locationId }: BuildingRoomsProps) {
  const t = useTranslations('rooms');
  const tBuildings = useTranslations('buildings');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const [selectedType, setSelectedType] = useState<RoomType>('all');

  const location = getLocationById(locationId);

  if (!location) {
    return null;
  }

  const roomPrices = location.roomPrices;
  const buildingName = isArabic ? location.neighborhoodAr : location.neighborhood;
  const cityName = isArabic ? location.cityAr : location.city;

  const filterTabs: { type: RoomType; label: string; icon: React.ReactNode }[] = [
    { type: 'all', label: isArabic ? 'الكل' : 'All', icon: null },
    { type: 'single', label: t('types.single'), icon: <User className="w-4 h-4" /> },
    { type: 'double', label: t('types.double'), icon: <Users className="w-4 h-4" /> },
    { type: 'triple', label: t('types.triple'), icon: <Users2 className="w-4 h-4" /> },
  ];

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
      default:
        return type;
    }
  };

  const getBathroomName = (bathroomType: string) => {
    switch (bathroomType) {
      case 'shared':
        return t('bathroom.shared');
      case 'private':
        return t('bathroom.private');
      case 'master':
        return t('bathroom.master');
      default:
        return bathroomType;
    }
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
                <Image
                  src={getRoomImage(room.type, room.bathroomType)}
                  alt={`${getRoomTypeName(room.type)} - ${getBathroomName(room.bathroomType)}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
                <div className="flex items-center gap-2 text-navy/60 mb-4">
                  <Bath className="w-4 h-4" />
                  <span className="text-sm">{getBathroomName(room.bathroomType)}</span>
                </div>

                {/* Pricing */}
                <div className="space-y-2 mb-6">
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
                </div>

                {/* CTA */}
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    window.location.href = `/${locale}/#contact`;
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-coral flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-navy font-medium">
                  {t('deposit')}: <span className="text-coral">{t('depositAmount')}</span>
                </p>
                <p className="text-navy/60 text-sm">{t('yearlyDiscount')}</p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                window.location.href = `/${locale}/#contact`;
              }}
            >
              {isArabic ? 'احجزي الآن' : 'Book Now'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

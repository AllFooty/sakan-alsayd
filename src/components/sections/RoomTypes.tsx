'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { User, Users, Users2, Bath } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

type RoomType = 'all' | 'single' | 'double' | 'triple';

// Define the room types we want to showcase (without prices)
const roomConfigurations = [
  { type: 'triple' as const, bathroomType: 'private' as const },
  { type: 'double' as const, bathroomType: 'shared' as const },
  { type: 'double' as const, bathroomType: 'private' as const },
  { type: 'single' as const, bathroomType: 'shared' as const },
  { type: 'single' as const, bathroomType: 'private' as const },
];

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

export default function RoomTypes() {
  const t = useTranslations('rooms');
  const tBuildings = useTranslations('buildings');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const [selectedType, setSelectedType] = useState<RoomType>('all');

  const filterTabs: { type: RoomType; label: string; icon: React.ReactNode }[] = [
    { type: 'all', label: isArabic ? 'الكل' : 'All', icon: null },
    { type: 'single', label: t('types.single'), icon: <User className="w-4 h-4" /> },
    { type: 'double', label: t('types.double'), icon: <Users className="w-4 h-4" /> },
    { type: 'triple', label: t('types.triple'), icon: <Users2 className="w-4 h-4" /> },
  ];

  const filteredRooms = selectedType === 'all'
    ? roomConfigurations
    : roomConfigurations.filter((room) => room.type === selectedType);

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

  return (
    <section id="rooms" className="section-padding bg-white">
      <div className="container mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-coral mb-4">
            {t('sectionTitle')}
          </h2>
          <p className="text-navy/70 mb-4">
            {t('sectionSubtitle')}
          </p>
          <p className="text-navy/50 text-sm">
            {tBuildings('pricesVary')}
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
                <div className="flex items-center gap-2 text-navy/60 mb-6">
                  <Bath className="w-4 h-4" />
                  <span className="text-sm">{getBathroomName(room.bathroomType)}</span>
                </div>

                {/* CTA */}
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    const locationsSection = document.getElementById('locations');
                    locationsSection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {tBuildings('viewBuildings')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { MapPin, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { usePublicBuildings } from '@/components/providers/PublicBuildingsProvider';
import { cn } from '@/lib/utils';

export default function Locations() {
  const { buildings, cities } = usePublicBuildings();
  const t = useTranslations('locations');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const filteredBuildings = selectedCity
    ? buildings.filter((b) => b.city === selectedCity)
    : buildings;

  return (
    <section id="locations" className="section-padding bg-cream">
      <div className="container mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-coral mb-4">
            {t('sectionTitle')}
          </h2>
          <p className="text-navy/70">
            {t('sectionSubtitle')}
          </p>
        </div>

        {/* City Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={() => setSelectedCity(null)}
            className={cn(
              'px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
              !selectedCity
                ? 'bg-coral text-white shadow-lg shadow-coral/25'
                : 'bg-white text-navy hover:bg-cream-dark'
            )}
          >
            {isArabic ? 'جميع المدن' : 'All Cities'}
          </button>
          {cities.map((city) => (
            <button
              key={city.name}
              onClick={() => setSelectedCity(city.name)}
              className={cn(
                'px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
                selectedCity === city.name
                  ? 'bg-coral text-white shadow-lg shadow-coral/25'
                  : 'bg-white text-navy hover:bg-cream-dark'
              )}
            >
              {isArabic ? city.nameAr : city.name}
            </button>
          ))}
        </div>

        {/* Locations Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBuildings.map((building) => (
            <Card key={building.id} variant="elevated" hover className="overflow-hidden">
              {/* Location Image */}
              <div className="relative h-48">
                <Image
                  src={building.coverImage}
                  alt={`${isArabic ? building.neighborhoodAr : building.neighborhood} - ${isArabic ? building.cityAr : building.city}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                {/* Placeholder Badge */}
                {building.isPlaceholder && (
                  <div className="absolute top-4 end-4 bg-navy/80 text-white text-xs px-2 py-1 rounded">
                    {isArabic ? 'قريباً' : 'Coming Soon'}
                  </div>
                )}
                {/* City Badge */}
                <div className="absolute bottom-4 start-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-coral" />
                  <span className="text-sm font-semibold text-navy">
                    {isArabic ? building.cityAr : building.city}
                  </span>
                </div>
              </div>

              <div className="p-6">
                {/* Neighborhood */}
                <h3 className="text-xl font-semibold text-navy mb-2">
                  {isArabic ? building.neighborhoodAr : building.neighborhood}
                </h3>
                <p className="text-navy/60 text-sm mb-4 line-clamp-2">
                  {isArabic ? building.descriptionAr : building.description}
                </p>

                {/* Nearby Places */}
                {building.nearbyLandmarks.length > 0 && (
                  <div className="space-y-2 mb-6">
                    <h4 className="text-sm font-medium text-navy">{t('nearbyPlaces')}</h4>
                    {building.nearbyLandmarks.slice(0, 3).map((landmark) => (
                      <div key={landmark.id} className="flex items-center justify-between text-sm">
                        <span className="text-navy/70">
                          {isArabic ? landmark.nameAr : landmark.name}
                        </span>
                        <span className="flex items-center gap-1 text-coral">
                          <Clock className="w-3 h-3" />
                          {isArabic ? landmark.distanceAr : landmark.distance}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <div className="flex gap-2">
                  {building.mapUrl && (
                    <a href={building.mapUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        {t('viewLocation')}
                      </Button>
                    </a>
                  )}
                  <Link href={`/${locale}/buildings/${building.id}`} className="flex-1">
                    <Button variant="primary" size="sm" className="w-full">
                      {t('viewRooms')}
                      {isArabic ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

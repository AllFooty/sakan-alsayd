'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export default function About() {
  const t = useTranslations('about');
  const locale = useLocale();
  const isArabic = locale === 'ar';

  return (
    <section id="about" className="section-padding bg-white">
      <div className="container mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div className={cn('space-y-6', isArabic ? 'lg:order-1' : 'lg:order-1')}>
            <h2 className="text-3xl md:text-4xl font-bold text-coral leading-tight">
              {t('sectionTitle')}
            </h2>

            <p className="text-navy/70 leading-relaxed text-lg">
              {t('description')}
            </p>

            <div className="pt-4">
              <h3 className="text-xl font-semibold text-navy mb-3">
                {t('vision')}
              </h3>
              <p className="text-navy/70 leading-relaxed">
                {t('visionText')}
              </p>
            </div>

          </div>

          {/* Image/Visual */}
          <div className={cn('relative', isArabic ? 'lg:order-2' : 'lg:order-2')}>
            <div className="relative">
              {/* Main Image */}
              <div className="relative rounded-3xl overflow-hidden aspect-[4/3]">
                <Image
                  src="/images/facilities/building-exterior.jpg"
                  alt={isArabic ? 'مبنى سكن السيد' : 'Sakan Alsayd Building'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>

              {/* Secondary Image - Overlay */}
              <div className="absolute -bottom-6 -start-6 w-48 h-48 rounded-2xl overflow-hidden shadow-2xl border-4 border-white hidden md:block">
                <Image
                  src="/images/facilities/lobby.jpg"
                  alt={isArabic ? 'ردهة المبنى' : 'Building Lobby'}
                  fill
                  className="object-cover"
                  sizes="200px"
                />
              </div>

              {/* Decorative Elements */}
              <div className="absolute -bottom-4 -end-4 w-24 h-24 bg-coral rounded-2xl -z-10" />
              <div className="absolute -top-4 -start-4 w-32 h-32 bg-navy/10 rounded-2xl -z-10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

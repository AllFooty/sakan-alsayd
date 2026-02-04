'use client';

import { useLocale, useTranslations } from 'next-intl';
import { services } from '@/data/services';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function Services() {
  const t = useTranslations();
  const locale = useLocale();
  const isArabic = locale === 'ar';

  return (
    <section id="services" className="section-padding bg-cream">
      <div className="container mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-coral mb-4">
            {t('services.sectionTitle')}
          </h2>
          <p className="text-navy/70">
            {t('services.sectionSubtitle')}
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <Card
              key={service.id}
              variant="elevated"
              hover
              className="p-6 group"
            >
              <div
                className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center mb-4',
                  'bg-coral/10 group-hover:bg-coral transition-colors duration-300'
                )}
              >
                <service.icon
                  className={cn(
                    'w-7 h-7 text-coral group-hover:text-white',
                    'transition-colors duration-300'
                  )}
                />
              </div>
              <h3 className="text-xl font-semibold text-navy mb-2">
                {t(service.titleKey)}
              </h3>
              <p className="text-navy/60 leading-relaxed">
                {t(service.descriptionKey)}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { MessageCircle, ChevronDown, Home } from 'lucide-react';
import { Button } from '@/components/ui';
import WhatsAppRegionModal from '@/components/ui/WhatsAppRegionModal';

export default function Hero() {
  const t = useTranslations('hero');
  const tAbout = useTranslations('about');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  const handleExploreRooms = () => {
    const locationsSection = document.getElementById('locations');
    locationsSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 z-0 bg-cream" />

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 z-[1]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231A3A5A' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-20 start-10 w-64 h-64 bg-coral/10 rounded-full blur-3xl z-[1]" />
      <div className="absolute bottom-20 end-10 w-96 h-96 bg-navy/5 rounded-full blur-3xl z-[1]" />

      <div className="container mx-auto px-4 py-32 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg shadow-navy/5 mb-8">
            <Home className="w-4 h-4 text-coral" />
            <span className="text-sm font-medium text-navy">
              {isArabic ? 'أكبر سكن طالبات و موظفات في المملكة' : 'Largest Student & Professional Housing in the Kingdom'}
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-navy mb-6 leading-tight">
            {t('title')}{' '}
            <span className="text-coral">{t('titleHighlight')}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-navy/70 mb-8 max-w-2xl mx-auto leading-relaxed whitespace-pre-wrap">
            {t('subtitle')}
          </p>

          {/* Secondary Tagline */}
          <div className="mb-8 text-xl md:text-2xl text-coral font-bold italic">
            {t('tagline')}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="primary"
              size="lg"
              onClick={handleExploreRooms}
              className="w-full sm:w-auto"
            >
              {t('exploreRooms')}
            </Button>
            <Button
              variant="whatsapp"
              size="lg"
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="w-full sm:w-auto"
            >
              <MessageCircle className="w-5 h-5" />
              {t('contactWhatsApp')}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-10 pt-10 border-t border-navy/10">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-coral mb-1">10+</div>
              <div className="text-sm text-navy/60">
                {tAbout('stats.years')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-coral mb-1">1300+</div>
              <div className="text-sm text-navy/60">
                {tAbout('stats.residents')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-coral mb-1">4</div>
              <div className="text-sm text-navy/60">
                {tAbout('stats.cities')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-coral mb-1">11</div>
              <div className="text-sm text-navy/60">
                {tAbout('stats.buildings')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-coral mb-1">10000+</div>
              <div className="text-sm text-navy/60">
                {tAbout('stats.allTimeResidents')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce z-10">
        <ChevronDown className="w-6 h-6 text-navy/40" />
      </div>

      {/* WhatsApp Region Modal */}
      <WhatsAppRegionModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />
    </section>
  );
}

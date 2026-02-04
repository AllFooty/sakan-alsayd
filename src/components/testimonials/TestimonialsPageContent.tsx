'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { allTestimonials, type Testimonial } from '@/data/testimonials';
import TestimonialsFilter from './TestimonialsFilter';
import TestimonialGrid from './TestimonialGrid';
import ScreenshotLightbox from './ScreenshotLightbox';
import VideoModal from './VideoModal';
import type { ScreenshotTestimonial, VideoTestimonial } from '@/data/testimonials';

export type FilterType = 'all' | 'quote' | 'screenshot' | 'video';

export default function TestimonialsPageContent() {
  const t = useTranslations('testimonials');
  const locale = useLocale();
  const isArabic = locale === 'ar';

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [lightboxItem, setLightboxItem] = useState<ScreenshotTestimonial | null>(null);
  const [videoItem, setVideoItem] = useState<VideoTestimonial | null>(null);

  // Filter testimonials based on active filter
  const filteredTestimonials = activeFilter === 'all'
    ? allTestimonials
    : allTestimonials.filter((t) => t.type === activeFilter);

  const handleOpenLightbox = (item: ScreenshotTestimonial) => {
    setLightboxItem(item);
  };

  const handleCloseLightbox = () => {
    setLightboxItem(null);
  };

  const handleOpenVideo = (item: VideoTestimonial) => {
    setVideoItem(item);
  };

  const handleCloseVideo = () => {
    setVideoItem(null);
  };

  return (
    <section className="section-padding bg-cream/30 min-h-screen">
      <div className="container mx-auto">
        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-coral mb-4">
            {t('pageTitle')}
          </h1>
          <p className="text-navy/70 text-lg">
            {t('pageSubtitle')}
          </p>
        </div>

        {/* Filter Tabs */}
        <TestimonialsFilter
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          isArabic={isArabic}
        />

        {/* Testimonials Grid */}
        {filteredTestimonials.length > 0 ? (
          <TestimonialGrid
            testimonials={filteredTestimonials}
            isArabic={isArabic}
            onOpenLightbox={handleOpenLightbox}
            onOpenVideo={handleOpenVideo}
          />
        ) : (
          <div className="text-center py-16">
            <p className="text-navy/60 text-lg">{t('noResults')}</p>
          </div>
        )}
      </div>

      {/* Screenshot Lightbox Modal */}
      {lightboxItem && (
        <ScreenshotLightbox
          item={lightboxItem}
          isArabic={isArabic}
          onClose={handleCloseLightbox}
        />
      )}

      {/* Video Modal */}
      {videoItem && (
        <VideoModal
          item={videoItem}
          isArabic={isArabic}
          onClose={handleCloseVideo}
        />
      )}
    </section>
  );
}

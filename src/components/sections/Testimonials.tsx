'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Quote, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { getFeaturedTestimonials } from '@/data/testimonials';
import QuoteModal from '@/components/testimonials/QuoteModal';
import { cn } from '@/lib/utils';
import type { QuoteTestimonial } from '@/data/testimonials';

const QUOTE_CHAR_LIMIT = 180;

export default function Testimonials() {
  const t = useTranslations('testimonials');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTestimonial, setSelectedTestimonial] = useState<QuoteTestimonial | null>(null);

  // Get only 3 featured testimonials for the landing page
  const featuredTestimonials = getFeaturedTestimonials(3);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % featuredTestimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + featuredTestimonials.length) % featuredTestimonials.length);
  };

  // Generate initials from name for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Truncate text to a certain character limit
  const getTruncatedQuote = (testimonial: QuoteTestimonial) => {
    const quote = isArabic ? testimonial.quoteAr : testimonial.quote;
    return {
      isTruncated: quote.length > QUOTE_CHAR_LIMIT,
      displayQuote: quote.length > QUOTE_CHAR_LIMIT
        ? quote.substring(0, QUOTE_CHAR_LIMIT)
        : quote,
    };
  };

  return (
    <section className="section-padding bg-white">
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

        {/* Testimonials Grid - Desktop */}
        <div className="hidden md:grid md:grid-cols-3 gap-6">
          {featuredTestimonials.map((testimonial) => {
            const { isTruncated, displayQuote } = getTruncatedQuote(testimonial);
            return (
              <Card key={testimonial.id} variant="elevated" className="p-6 flex flex-col">
                {/* Quote Icon */}
                <Quote className="w-10 h-10 text-coral/20 mb-4" />

                {/* Quote Text */}
                <p className="text-navy/70 leading-relaxed mb-6 flex-grow">
                  &ldquo;{displayQuote}{isTruncated && '…'}&rdquo;
                </p>

                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'w-4 h-4',
                        i < testimonial.rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-200'
                      )}
                    />
                  ))}
                </div>

                {/* Author */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-coral/10 flex items-center justify-center">
                    {testimonial.image && testimonial.image !== '/images/testimonials/placeholder.jpg' ? (
                      <Image
                        src={testimonial.image}
                        alt={isArabic ? testimonial.nameAr : testimonial.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-coral font-semibold text-sm">
                        {getInitials(isArabic ? testimonial.nameAr : testimonial.name)}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-navy">
                      {isArabic ? testimonial.nameAr : testimonial.name}
                    </h4>
                    <p className="text-sm text-navy/60">
                      {isArabic ? testimonial.buildingAr : testimonial.building}
                    </p>
                    <p className="text-xs text-coral">
                      {isArabic ? testimonial.cityAr : testimonial.city}
                    </p>
                  </div>
                </div>

                {/* Read More Button */}
                {isTruncated && (
                  <button
                    onClick={() => setSelectedTestimonial(testimonial)}
                    className="text-coral font-semibold text-sm hover:text-coral/80 transition-colors text-start"
                  >
                    {t('readMore')} →
                  </button>
                )}
              </Card>
            );
          })}
        </div>

        {/* Testimonials Carousel - Mobile */}
        <div className="md:hidden">
          {(() => {
            const currentTestimonial = featuredTestimonials[currentIndex];
            const { isTruncated, displayQuote } = getTruncatedQuote(currentTestimonial);
            return (
              <Card variant="elevated" className="p-6 flex flex-col">
                {/* Quote Icon */}
                <Quote className="w-10 h-10 text-coral/20 mb-4" />

                {/* Quote Text */}
                <p className="text-navy/70 leading-relaxed mb-6 flex-grow">
                  &ldquo;{displayQuote}{isTruncated && '…'}&rdquo;
                </p>

                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'w-4 h-4',
                        i < currentTestimonial.rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-200'
                      )}
                    />
                  ))}
                </div>

                {/* Author */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-coral/10 flex items-center justify-center">
                    {currentTestimonial.image && currentTestimonial.image !== '/images/testimonials/placeholder.jpg' ? (
                      <Image
                        src={currentTestimonial.image}
                        alt={isArabic ? currentTestimonial.nameAr : currentTestimonial.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-coral font-semibold text-sm">
                        {getInitials(isArabic ? currentTestimonial.nameAr : currentTestimonial.name)}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-navy">
                      {isArabic ? currentTestimonial.nameAr : currentTestimonial.name}
                    </h4>
                    <p className="text-sm text-navy/60">
                      {isArabic ? currentTestimonial.buildingAr : currentTestimonial.building}
                    </p>
                    <p className="text-xs text-coral">
                      {isArabic ? currentTestimonial.cityAr : currentTestimonial.city}
                    </p>
                  </div>
                </div>

                {/* Read More Button */}
                {isTruncated && (
                  <button
                    onClick={() => setSelectedTestimonial(currentTestimonial)}
                    className="text-coral font-semibold text-sm hover:text-coral/80 transition-colors text-start"
                  >
                    {t('readMore')} →
                  </button>
                )}
              </Card>
            );
          })()}


          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={prevTestimonial}
              className="p-2 rounded-full bg-cream hover:bg-coral hover:text-white transition-colors"
              aria-label="Previous testimonial"
            >
              {isArabic ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
            <div className="flex gap-2">
              {featuredTestimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    currentIndex === i ? 'bg-coral' : 'bg-navy/20'
                  )}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={nextTestimonial}
              className="p-2 rounded-full bg-cream hover:bg-coral hover:text-white transition-colors"
              aria-label="Next testimonial"
            >
              {isArabic ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* View All Button */}
        <div className="text-center mt-10">
          <Link href={`/${locale}/testimonials`}>
            <Button variant="outline" size="lg">
              {t('viewAll')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Quote Modal */}
      {selectedTestimonial && (
        <QuoteModal
          testimonial={selectedTestimonial}
          isArabic={isArabic}
          onClose={() => setSelectedTestimonial(null)}
        />
      )}
    </section>
  );
}

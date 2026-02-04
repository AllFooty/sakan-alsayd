'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Quote, Star } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import QuoteModal from './QuoteModal';
import type { QuoteTestimonial } from '@/data/testimonials';

interface QuoteCardProps {
  testimonial: QuoteTestimonial;
  isArabic: boolean;
}

const QUOTE_CHAR_LIMIT = 180;

export default function QuoteCard({ testimonial, isArabic }: QuoteCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

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
  const quote = isArabic ? testimonial.quoteAr : testimonial.quote;
  const isTruncated = quote.length > QUOTE_CHAR_LIMIT;
  const displayQuote = isTruncated ? quote.substring(0, QUOTE_CHAR_LIMIT) : quote;

  return (
    <>
      <Card variant="elevated" className="p-6 h-full flex flex-col">
        {/* Quote Icon */}
        <Quote className="w-10 h-10 text-coral/20 mb-4 flex-shrink-0" />

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
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-coral/10 flex items-center justify-center flex-shrink-0">
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
            onClick={() => setIsModalOpen(true)}
            className="text-coral font-semibold text-sm hover:text-coral/80 transition-colors text-start"
          >
            Read more →
          </button>
        )}
      </Card>

      {/* Quote Modal */}
      {isModalOpen && (
        <QuoteModal
          testimonial={testimonial}
          isArabic={isArabic}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

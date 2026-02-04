'use client';

import Image from 'next/image';
import { useEffect, useCallback } from 'react';
import { X, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuoteTestimonial } from '@/data/testimonials';

interface QuoteModalProps {
  testimonial: QuoteTestimonial;
  isArabic: boolean;
  onClose: () => void;
}

export default function QuoteModal({
  testimonial,
  isArabic,
  onClose,
}: QuoteModalProps) {
  // Generate initials from name for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Handle ESC key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [handleKeyDown]);

  // Close when clicking backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className={`absolute top-4 ${isArabic ? 'left-4' : 'right-4'} p-2 rounded-full bg-white hover:bg-gray-100 text-navy transition-colors z-10`}
        aria-label="Close modal"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Modal Content */}
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Full Quote Text */}
        <p className="text-navy/70 leading-relaxed mb-8 text-lg">
          &ldquo;{isArabic ? testimonial.quoteAr : testimonial.quote}&rdquo;
        </p>

        {/* Rating */}
        <div className="flex gap-1 mb-8">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={cn(
                'w-5 h-5',
                i < testimonial.rating
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-200'
              )}
            />
          ))}
        </div>

        {/* Author Info */}
        <div className="pt-6 border-t border-gray-200">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-coral/10 flex items-center justify-center flex-shrink-0">
              {testimonial.image &&
              testimonial.image !== '/images/testimonials/placeholder.jpg' ? (
                <Image
                  src={testimonial.image}
                  alt={isArabic ? testimonial.nameAr : testimonial.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="text-coral font-semibold text-lg">
                  {getInitials(
                    isArabic ? testimonial.nameAr : testimonial.name
                  )}
                </span>
              )}
            </div>
            <div>
              <h4 className="font-semibold text-navy text-lg">
                {isArabic ? testimonial.nameAr : testimonial.name}
              </h4>
              <p className="text-navy/60">
                {isArabic ? testimonial.buildingAr : testimonial.building}
              </p>
              <p className="text-coral font-medium">
                {isArabic ? testimonial.cityAr : testimonial.city}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

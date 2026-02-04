'use client';

import { useEffect, useCallback } from 'react';
import Image from 'next/image';
import { X, MapPin, Camera, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ScreenshotTestimonial } from '@/data/testimonials';

interface ScreenshotLightboxProps {
  item: ScreenshotTestimonial;
  isArabic: boolean;
  onClose: () => void;
}

// Source icons mapping
const sourceIcons: Record<string, typeof MapPin> = {
  google_maps: MapPin,
  twitter: MessageCircle,
  instagram: Camera,
  whatsapp: MessageCircle,
  other: Camera,
};

export default function ScreenshotLightbox({
  item,
  isArabic,
  onClose,
}: ScreenshotLightboxProps) {
  const t = useTranslations('testimonials.lightbox');
  const Icon = sourceIcons[item.source] || Camera;

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={handleBackdropClick}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className={`absolute top-4 ${isArabic ? 'left-4' : 'right-4'} p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10`}
        aria-label={t('close')}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image Container */}
      <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center">
        <div className="relative w-full h-full">
          <Image
            src={item.imageUrl}
            alt={isArabic ? item.altAr : item.alt}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        </div>

        {/* Source Badge */}
        <div className={`absolute bottom-4 ${isArabic ? 'right-4' : 'left-4'}`}>
          <div className="bg-white/90 text-navy px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium shadow-lg">
            <Icon className="w-4 h-4" />
            <span>{isArabic ? item.sourceLabelAr : item.sourceLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

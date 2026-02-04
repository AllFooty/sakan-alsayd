'use client';

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VideoTestimonial } from '@/data/testimonials';

interface VideoModalProps {
  item: VideoTestimonial;
  isArabic: boolean;
  onClose: () => void;
}

export default function VideoModal({
  item,
  isArabic,
  onClose,
}: VideoModalProps) {
  const t = useTranslations('testimonials.lightbox');

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

      {/* Video Container */}
      <div className="relative w-full max-w-4xl">
        {/* Video Title */}
        <h3 className="text-white text-xl font-semibold mb-4 text-center">
          {isArabic ? item.titleAr : item.title}
        </h3>

        {/* YouTube Embed */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?rel=0&modestbranding=1&autoplay=1`}
            title={isArabic ? item.titleAr : item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>

        {/* Video Author */}
        {item.name && (
          <p className="text-white/70 text-center mt-4">
            {isArabic ? item.nameAr : item.name}
          </p>
        )}
      </div>
    </div>
  );
}

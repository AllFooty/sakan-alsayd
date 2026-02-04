'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { MapPin, Camera, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui';
import type { ScreenshotTestimonial } from '@/data/testimonials';

interface ScreenshotCardProps {
  testimonial: ScreenshotTestimonial;
  isArabic: boolean;
  onOpenLightbox: (item: ScreenshotTestimonial) => void;
}

// Source icons mapping
const sourceIcons: Record<string, typeof MapPin> = {
  google_maps: MapPin,
  twitter: MessageCircle,
  instagram: Camera,
  whatsapp: MessageCircle,
  other: Camera,
};

// Source colors mapping
const sourceColors: Record<string, string> = {
  google_maps: 'bg-green-500',
  twitter: 'bg-blue-400',
  instagram: 'bg-pink-500',
  whatsapp: 'bg-green-600',
  other: 'bg-gray-500',
};

export default function ScreenshotCard({
  testimonial,
  isArabic,
  onOpenLightbox,
}: ScreenshotCardProps) {
  const t = useTranslations('testimonials.sources');
  const Icon = sourceIcons[testimonial.source] || Camera;
  const colorClass = sourceColors[testimonial.source] || 'bg-gray-500';

  return (
    <Card
      variant="elevated"
      className="overflow-hidden cursor-pointer group"
      onClick={() => onOpenLightbox(testimonial)}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={testimonial.imageUrl}
          alt={isArabic ? testimonial.altAr : testimonial.alt}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 text-navy px-4 py-2 rounded-full text-sm font-medium">
            {isArabic ? 'اضغط للتكبير' : 'Click to enlarge'}
          </span>
        </div>

        {/* Source Badge */}
        <div className={`absolute top-3 ${isArabic ? 'left-3' : 'right-3'}`}>
          <div className={`${colorClass} text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-medium shadow-md`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{isArabic ? testimonial.sourceLabelAr : testimonial.sourceLabel}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

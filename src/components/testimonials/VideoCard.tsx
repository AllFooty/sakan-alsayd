'use client';

import Image from 'next/image';
import { Play, Clock } from 'lucide-react';
import { Card } from '@/components/ui';
import type { VideoTestimonial } from '@/data/testimonials';

interface VideoCardProps {
  testimonial: VideoTestimonial;
  isArabic: boolean;
  onOpenVideo: (item: VideoTestimonial) => void;
}

export default function VideoCard({
  testimonial,
  isArabic,
  onOpenVideo,
}: VideoCardProps) {
  return (
    <Card
      variant="elevated"
      className="overflow-hidden cursor-pointer group"
      onClick={() => onOpenVideo(testimonial)}
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-video overflow-hidden">
        <Image
          src={testimonial.thumbnailUrl}
          alt={isArabic ? testimonial.titleAr : testimonial.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />

        {/* Play Button Overlay */}
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-coral flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
            <Play className="w-7 h-7 text-white fill-white ml-1" />
          </div>
        </div>

        {/* Duration Badge */}
        {testimonial.duration && (
          <div className={`absolute bottom-3 ${isArabic ? 'left-3' : 'right-3'}`}>
            <div className="bg-black/70 text-white px-2 py-1 rounded flex items-center gap-1.5 text-xs font-medium">
              <Clock className="w-3 h-3" />
              <span>{testimonial.duration}</span>
            </div>
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="p-4">
        <h3 className="font-semibold text-navy mb-1 line-clamp-2">
          {isArabic ? testimonial.titleAr : testimonial.title}
        </h3>
        {testimonial.name && (
          <p className="text-sm text-navy/60">
            {isArabic ? testimonial.nameAr : testimonial.name}
          </p>
        )}
      </div>
    </Card>
  );
}

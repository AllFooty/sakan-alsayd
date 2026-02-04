'use client';

import type { Testimonial, ScreenshotTestimonial, VideoTestimonial } from '@/data/testimonials';
import QuoteCard from './QuoteCard';
import ScreenshotCard from './ScreenshotCard';
import VideoCard from './VideoCard';

interface TestimonialGridProps {
  testimonials: Testimonial[];
  isArabic: boolean;
  onOpenLightbox: (item: ScreenshotTestimonial) => void;
  onOpenVideo: (item: VideoTestimonial) => void;
}

export default function TestimonialGrid({
  testimonials,
  isArabic,
  onOpenLightbox,
  onOpenVideo,
}: TestimonialGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {testimonials.map((testimonial) => {
        switch (testimonial.type) {
          case 'quote':
            return (
              <QuoteCard
                key={testimonial.id}
                testimonial={testimonial}
                isArabic={isArabic}
              />
            );
          case 'screenshot':
            return (
              <ScreenshotCard
                key={testimonial.id}
                testimonial={testimonial}
                isArabic={isArabic}
                onOpenLightbox={onOpenLightbox}
              />
            );
          case 'video':
            return (
              <VideoCard
                key={testimonial.id}
                testimonial={testimonial}
                isArabic={isArabic}
                onOpenVideo={onOpenVideo}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

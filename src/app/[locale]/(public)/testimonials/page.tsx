import { setRequestLocale } from 'next-intl/server';
import { Header, Footer } from '@/components/layout';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import TestimonialsPageContent from '@/components/testimonials/TestimonialsPageContent';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isArabic = locale === 'ar';

  return {
    title: isArabic
      ? 'تجارب صديقات السكن | سكن السيد'
      : 'Testimonials | Sakan Alsayd',
    description: isArabic
      ? 'تجارب حقيقية من طالبات وموظفات يسكنّ في سكن السيد - تقييمات وصور وفيديوهات'
      : 'Real experiences from students and working women living at Sakan Alsayd - reviews, screenshots, and videos',
  };
}

export default async function TestimonialsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Header />
      <main className="pt-20">
        <TestimonialsPageContent />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}

import { setRequestLocale } from 'next-intl/server';
import { Header, Footer } from '@/components/layout';
import {
  Hero,
  About,
  Services,
  Locations,
  Testimonials,
  FAQ,
  Contact,
} from '@/components/sections';
import WhatsAppButton from '@/components/layout/WhatsAppButton';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <>
      <Header />
      <main>
        <Hero />
        <About />
        <Services />
        <Locations />
        <Testimonials />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}

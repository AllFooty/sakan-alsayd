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

const showLocations = process.env.NEXT_PUBLIC_SHOW_LOCATIONS === 'true';

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
        {showLocations && <Locations />}
        <Testimonials />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}

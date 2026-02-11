import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { IBM_Plex_Sans_Arabic, IBM_Plex_Sans } from 'next/font/google';
import { locales, type Locale } from '@/i18n/config';
import { getDirection } from '@/lib/utils';
import type { Metadata } from 'next';

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-english',
  display: 'swap',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const isArabic = locale === 'ar';

  return {
    title: isArabic
      ? 'سكن السيد - سكن طالبات وموظفات آمن بإشراف 24/7 | الخبر الرياض الدمام'
      : 'Sakan Alsayd - Safe Student & Professional Housing in Saudi Arabia',
    description: isArabic
      ? 'سكن السيد - بيئة آمنة ومحافظة مع إشراف 24/7 وخدمات متكاملة. 11 فرع في 4 مدن بالسعودية'
      : 'Sakan Alsayd - Safe, conservative housing with 24/7 supervision and complete services. 11 branches in 4 Saudi cities',
    keywords: isArabic
      ? ['سكن طالبات آمن', 'سكن السيد', 'سكن الرياض', 'سكن الخبر', 'سكن الدمام', 'سكن طالبات جامعة الأميرة نورة', 'شقق مفروشة', 'سكن محافظ', 'إشراف 24/7']
      : ['safe student housing', 'Sakan Alsayd', 'Riyadh housing', 'furnished apartments', 'Saudi Arabia', '24/7 supervision'],
    openGraph: {
      title: isArabic ? 'سكن السيد' : 'Sakan Alsayd',
      description: isArabic
        ? 'بيئة آمنة ومحافظة مع إشراف على مدار الساعة وخدمات متكاملة'
        : 'Safe and conservative environment with 24/7 supervision and comprehensive services',
      locale: isArabic ? 'ar_SA' : 'en_US',
      type: 'website',
      url: 'https://sakanalsayd.com',
      images: [
        {
          url: 'https://sakanalsayd.com/og-image.jpg',
          width: 1200,
          height: 630,
          alt: isArabic ? 'سكن السيد' : 'Sakan Alsayd',
        },
      ],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Get messages for the current locale
  const messages = await getMessages();

  const direction = getDirection(locale);
  const fontClass = locale === 'ar'
    ? `${ibmPlexSansArabic.variable} ${ibmPlexSans.variable}`
    : `${ibmPlexSans.variable} ${ibmPlexSansArabic.variable}`;

  return (
    <html lang={locale} dir={direction} className={fontClass}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

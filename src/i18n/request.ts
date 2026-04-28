import { getRequestConfig } from 'next-intl/server';
import { locales, type Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Validate that the incoming `locale` parameter is valid
  if (!locale || !locales.includes(locale as Locale)) {
    locale = 'ar';
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Force Western Arabic numerals (0–9) for all ICU number substitutions.
    // The `ar` locale's default numbering system is `arab` (Arabic-Indic
    // digits). Saudi Arabia uses Western numerals everywhere — pinning
    // numberingSystem: 'latn' here covers any {value}/{value, number}
    // interpolation site without each component having to pre-format.
    formats: {
      number: {
        default: { numberingSystem: 'latn' },
      },
    },
  };
});

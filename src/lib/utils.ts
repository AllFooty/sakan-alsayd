import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function getDirection(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** Saudi mobile phone: exactly 10 digits starting with 05 */
export const SAUDI_PHONE_REGEX = /^05\d{8}$/;

export function isValidSaudiPhone(phone: string): boolean {
  return SAUDI_PHONE_REGEX.test(phone);
}

/**
 * Sanitize phone input: convert Eastern/Extended Arabic-Indic numerals to
 * Western (0-9), strip non-digits, normalize +966/966 prefix → 0, cap at 10.
 */
export function sanitizePhoneInput(value: string): string {
  let result = toWesternNumerals(value);
  result = result.replace(/\D/g, '');
  if (result.startsWith('966') && result.length > 10) {
    result = '0' + result.slice(3);
  }
  return result.slice(0, 10);
}

/**
 * Convert a phone number to a WhatsApp URL.
 * Handles: +966..., 00966..., 05..., and raw numbers.
 */
/**
 * Replace Eastern Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹)
 * numerals with Western Arabic (0-9) numerals.
 */
export function toWesternNumerals(str: string): string {
  return str
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Format a date string for display. Always uses Western Arabic numerals (0-9).
 * Arabic locale gets Arabic month names; English locale gets English month names.
 */
export function formatDate(
  dateStr: string,
  locale: string,
  options?: { includeTime?: boolean }
): string {
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...(options?.includeTime && {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
  };

  const bcp47Locale = locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  const formatted = new Date(dateStr).toLocaleDateString(bcp47Locale, dateOptions);
  return toWesternNumerals(formatted);
}

export function toWhatsAppUrl(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = '966' + cleaned.substring(1);
  }
  return `https://wa.me/${cleaned}`;
}

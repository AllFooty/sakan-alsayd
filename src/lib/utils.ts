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
  let result = value.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  result = result.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
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

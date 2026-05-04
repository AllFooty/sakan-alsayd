'use client';

import { useEffect, useCallback } from 'react';
import FocusLock from 'react-focus-lock';
import { X, MessageCircle, MapPin } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { contacts } from '@/data/contacts';

interface WhatsAppRegionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Get customer service contacts (Eastern first since it's headquarters)
const customerServiceContacts = contacts.filter((c) =>
  c.id.startsWith('customer-service-')
).sort((a, b) => {
  // Eastern first
  if (a.id.includes('eastern')) return -1;
  if (b.id.includes('eastern')) return 1;
  return 0;
});

// Format phone for display: 0XX XX XXX XX
const formatPhoneDisplay = (phone: string): string => {
  const local = phone.startsWith('966') ? '0' + phone.slice(3) : phone;
  return `${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 8)} ${local.slice(8)}`;
};

export default function WhatsAppRegionModal({
  isOpen,
  onClose,
}: WhatsAppRegionModalProps) {
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const t = useTranslations('whatsappModal');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // iOS-safe scroll lock matching the other modals (BookingModal,
  // MaintenanceModal, ConfirmDialog). The naïve overflow:hidden lock can
  // leak `position:fixed` onto <body> if a stacked modal unwinds in a
  // different order than it locked.
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);

    const scrollY = window.scrollY;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyWidth = document.body.style.width;
    const prevBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.width = prevBodyWidth;
      document.body.style.overflow = prevBodyOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleRegionClick = (whatsappNumber: string) => {
    window.open(`https://wa.me/${whatsappNumber}`, '_blank');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <FocusLock returnFocus={{ preventScroll: true }}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white dark:bg-[var(--admin-surface)] rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 ${isArabic ? 'left-4' : 'right-4'} p-2 rounded-full hover:bg-gray-100 dark:bg-[var(--admin-surface-2)] text-gray-500 dark:text-[var(--admin-text-muted)] transition-colors`}
          aria-label={t('close')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366]/10 mb-4">
            <MessageCircle className="w-7 h-7 text-[#25D366]" />
          </div>
          <h2 className="text-xl font-bold text-navy-900 mb-2">
            {t('title')}
          </h2>
          <p className="text-gray-600 dark:text-[var(--admin-text-muted)] text-sm">
            {t('subtitle')}
          </p>
        </div>

        {/* Region Options */}
        <div className="space-y-3">
          {customerServiceContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => handleRegionClick(contact.whatsapp || '')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 dark:border-[var(--admin-border)] hover:border-[#25D366] hover:bg-[#25D366]/5 transition-all group text-left"
              dir={isArabic ? 'rtl' : 'ltr'}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 dark:bg-[var(--admin-surface-2)] group-hover:bg-[#25D366]/20 flex items-center justify-center transition-colors">
                <MapPin className="w-5 h-5 text-gray-500 dark:text-[var(--admin-text-muted)] group-hover:text-[#25D366]" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-navy-900">
                  {isArabic ? contact.typeAr : contact.type}
                </div>
                <div className="text-gray-500 dark:text-[var(--admin-text-muted)] text-sm" dir="ltr">
                  {formatPhoneDisplay(contact.phone)}
                </div>
              </div>
              <MessageCircle className="w-5 h-5 text-gray-400 dark:text-[var(--admin-text-subtle)] group-hover:text-[#25D366] transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
    </FocusLock>
  );
}

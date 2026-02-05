'use client';

import { useEffect, useCallback } from 'react';
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

  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 ${isArabic ? 'left-4' : 'right-4'} p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors`}
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
          <p className="text-gray-600 text-sm">
            {t('subtitle')}
          </p>
        </div>

        {/* Region Options */}
        <div className="space-y-3">
          {customerServiceContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => handleRegionClick(contact.whatsapp || '')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-[#25D366] hover:bg-[#25D366]/5 transition-all group text-left"
              dir={isArabic ? 'rtl' : 'ltr'}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 group-hover:bg-[#25D366]/20 flex items-center justify-center transition-colors">
                <MapPin className="w-5 h-5 text-gray-500 group-hover:text-[#25D366]" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-navy-900">
                  {isArabic ? contact.typeAr : contact.type}
                </div>
                <div className="text-gray-500 text-sm" dir="ltr">
                  {formatPhoneDisplay(contact.phone)}
                </div>
              </div>
              <MessageCircle className="w-5 h-5 text-gray-400 group-hover:text-[#25D366] transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqKeys = [
  'documents',
  'checkInOut',
  'visitors',
  'holidays',
  'deposit',
  'transport',
  'included',
] as const;

export default function FAQ() {
  const t = useTranslations('faq');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleQuestion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="section-padding bg-cream">
      <div className="container mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Section Header */}
          <div className="lg:sticky lg:top-24">
            <h2 className="text-3xl md:text-4xl font-bold text-coral mb-4">
              {t('sectionTitle')}
            </h2>
            <p className="text-navy/70 mb-6">
              {t('sectionSubtitle')}
            </p>

            {/* Download Terms */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-coral/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-coral" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-navy mb-2">
                    {t('downloadTerms')}
                  </h4>
                  <p className="text-sm text-navy/60 mb-4">
                    {t('termsNote')}
                  </p>
                  <button className="inline-flex items-center gap-2 text-coral font-medium text-sm hover:underline">
                    <Download className="w-4 h-4" />
                    {isArabic ? 'تحميل PDF' : 'Download PDF'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Accordion */}
          <div className="space-y-3">
            {faqKeys.map((key, index) => (
              <div
                key={key}
                className={cn(
                  'bg-white rounded-2xl overflow-hidden transition-shadow duration-200',
                  openIndex === index ? 'shadow-lg shadow-navy/5' : 'shadow-sm'
                )}
              >
                <button
                  onClick={() => toggleQuestion(index)}
                  className="w-full flex items-center justify-between p-5 text-start"
                  aria-expanded={openIndex === index}
                >
                  <span className="font-semibold text-navy pe-4">
                    {t(`questions.${key}.question`)}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-5 h-5 text-coral flex-shrink-0 transition-transform duration-200',
                      openIndex === index && 'rotate-180'
                    )}
                  />
                </button>
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-300',
                    openIndex === index ? 'max-h-96' : 'max-h-0'
                  )}
                >
                  <div className="px-5 pb-5">
                    <p className="text-navy/70 leading-relaxed">
                      {t(`questions.${key}.answer`)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

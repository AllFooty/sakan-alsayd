'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import dynamic from 'next/dynamic';
import { Phone, MessageCircle, Send, CheckCircle, AlertCircle, RotateCcw, Wrench } from 'lucide-react';
import { Button, Input, Textarea, Select, PhoneInput } from '@/components/ui';
import WhatsAppRegionModal from '@/components/ui/WhatsAppRegionModal';
import { contacts } from '@/data/contacts';
import { usePublicBuildings } from '@/components/providers/PublicBuildingsProvider';
import { SAUDI_PHONE_REGEX } from '@/lib/utils';
import { classifyError, type SubmitErrorKind } from '@/lib/errors/catalog';

// Lazy: maintenance is for existing residents — most home-page visitors
// never open it. Holds back the photo-upload tree + extra lucide icons.
const MaintenanceModal = dynamic(
  () => import('@/components/ui/MaintenanceModal'),
  { ssr: false }
);

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  city: string;
  message: string;
}

export default function Contact() {
  const t = useTranslations('contact');
  const tErr = useTranslations('errors.submitFailure');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitErrorKind, setSubmitErrorKind] = useState<SubmitErrorKind>('unknown');
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  const { cities } = usePublicBuildings();
  const cityOptions = cities.map((city) => ({
    value: city.name.toLowerCase(),
    label: isArabic ? city.nameAr : city.name,
  }));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>();

  const onSubmit = async (data: ContactFormData) => {
    setSubmitStatus('loading');

    let res: Response | undefined;
    try {
      res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to submit');

      setSubmitStatus('success');
      reset();

      setTimeout(() => setSubmitStatus('idle'), 3000);
    } catch (err) {
      // Keep the error visible until the user retries or moves on — auto-
      // dismissing it would race with the Retry button below.
      setSubmitErrorKind(classifyError({ res, err }));
      setSubmitStatus('error');
    }
  };

  const handleWhatsAppClick = () => {
    setIsWhatsAppModalOpen(true);
  };

  return (
    <section id="contact" className="section-padding bg-white">
      <div className="container mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-coral mb-4">
            {t('sectionTitle')}
          </h2>
          <p className="text-navy/70">
            {t('sectionSubtitle')}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-cream rounded-3xl p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label={t('form.name')}
                placeholder={t('placeholders.fullName')}
                error={errors.name?.message}
                {...register('name', {
                  required: 'Name is required',
                  minLength: { value: 2, message: 'Name is required' },
                })}
              />

              <div className="grid sm:grid-cols-2 gap-5">
                <Input
                  label={t('form.email')}
                  type="email"
                  placeholder={t('placeholders.email')}
                  error={errors.email?.message}
                  {...register('email', {
                    required: 'Invalid email address',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Invalid email address',
                    },
                  })}
                />
                <PhoneInput
                  label={t('form.phone')}
                  placeholder={t('placeholders.phone')}
                  formatHint={t('form.phoneHint')}
                  error={errors.phone ? t('form.invalidPhone') : undefined}
                  {...register('phone', {
                    required: 'invalidPhone',
                    pattern: { value: SAUDI_PHONE_REGEX, message: 'invalidPhone' },
                  })}
                />
              </div>

              <Select
                label={t('form.city')}
                options={cityOptions}
                placeholder={t('placeholders.city')}
                error={errors.city?.message}
                {...register('city', { required: 'Please select a city' })}
              />

              <Textarea
                label={t('form.message')}
                placeholder={t('placeholders.message')}
                rows={4}
                error={errors.message?.message}
                {...register('message', {
                  required: 'Message must be at least 10 characters',
                  minLength: {
                    value: 10,
                    message: 'Message must be at least 10 characters',
                  },
                })}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={submitStatus === 'loading'}
                disabled={submitStatus === 'loading'}
              >
                {submitStatus === 'loading' ? (
                  t('form.submitting')
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    {t('form.submit')}
                  </>
                )}
              </Button>

              {/* Status Messages */}
              {submitStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-xl">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{t('form.success')}</span>
                </div>
              )}
              {submitStatus === 'error' && (
                <div className="flex items-start gap-3 text-red-600 bg-red-50 p-4 rounded-xl" role="alert">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{tErr(submitErrorKind)}</p>
                    <button
                      type="button"
                      onClick={() => handleSubmit(onSubmit)()}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-800 underline underline-offset-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {tErr('retry')}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            {/* WhatsApp Card */}
            <div className="bg-[#25D366]/10 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-navy text-lg">
                    {t('whatsapp')}
                  </h3>
                  <p className="text-navy/60 text-sm">
                    {t('whatsappSubtitle')}
                  </p>
                </div>
              </div>
              <Button
                variant="whatsapp"
                className="w-full"
                onClick={handleWhatsAppClick}
              >
                <MessageCircle className="w-5 h-5" />
                {t('startChat')}
              </Button>
            </div>

            {/* Maintenance Request Card */}
            <div className="bg-amber-50 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center">
                  <Wrench className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-navy text-lg">
                    {t('maintenanceTitle')}
                  </h3>
                  <p className="text-navy/60 text-sm">
                    {t('maintenanceSubtitle')}
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                className="w-full bg-amber-500 hover:bg-amber-600"
                onClick={() => setIsMaintenanceOpen(true)}
              >
                <Wrench className="w-5 h-5" />
                {t('submitMaintenance')}
              </Button>
            </div>

            {/* Contact Numbers */}
            <div className="bg-cream rounded-2xl p-6">
              <h3 className="font-semibold text-navy text-lg mb-4">
                {t('contactNumbers')}
              </h3>
              <div className="space-y-4">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                        <Phone className="w-5 h-5 text-coral" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-navy">
                          {isArabic ? contact.typeAr : contact.type}
                        </p>
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-navy/60 text-sm hover:text-coral transition-colors"
                          dir="ltr"
                        >
                          {contact.phone.replace(/(\d{3})(\d{2})(\d{3})(\d{2})/, '$1 $2 $3 $4')}
                        </a>
                      </div>
                    </div>
                    {contact.whatsapp && (
                      <a
                        href={`https://wa.me/${contact.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-[#25D366]/10 rounded-lg hover:bg-[#25D366]/20 transition-colors"
                        aria-label={`WhatsApp ${isArabic ? contact.typeAr : contact.type}`}
                      >
                        <MessageCircle className="w-5 h-5 text-[#25D366]" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Business Hours */}
            <div className="bg-navy/5 rounded-2xl p-6">
              <h3 className="font-semibold text-navy text-lg mb-2">
                {t('businessHours')}
              </h3>
              <p className="text-navy/70">
                {t('businessHoursWeekday')}
              </p>
              <p className="text-navy/70">
                {t('businessHoursFriday')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <WhatsAppRegionModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />
      {isMaintenanceOpen && (
        <MaintenanceModal
          isOpen
          onClose={() => setIsMaintenanceOpen(false)}
        />
      )}
    </section>
  );
}

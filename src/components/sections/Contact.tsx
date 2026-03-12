'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, MessageCircle, Send, CheckCircle, AlertCircle, Wrench } from 'lucide-react';
import { Button, Input, Textarea, Select } from '@/components/ui';
import WhatsAppRegionModal from '@/components/ui/WhatsAppRegionModal';
import MaintenanceModal from '@/components/ui/MaintenanceModal';
import { contacts } from '@/data/contacts';
import { getCities } from '@/data/locations';
import { cn } from '@/lib/utils';

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(9, 'Phone number is required'),
  city: z.string().min(1, 'Please select a city'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function Contact() {
  const t = useTranslations('contact');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  const cities = getCities();
  const cityOptions = cities.map((city) => ({
    value: city.name.toLowerCase(),
    label: isArabic ? city.nameAr : city.name,
  }));

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setSubmitStatus('loading');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Failed to submit');

      setSubmitStatus('success');
      reset();

      setTimeout(() => setSubmitStatus('idle'), 3000);
    } catch {
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 3000);
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
                {...register('name')}
              />

              <div className="grid sm:grid-cols-2 gap-5">
                <Input
                  label={t('form.email')}
                  type="email"
                  placeholder={t('placeholders.email')}
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Input
                  label={t('form.phone')}
                  type="tel"
                  placeholder={t('placeholders.phone')}
                  dir="ltr"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
              </div>

              <Select
                label={t('form.city')}
                options={cityOptions}
                placeholder={t('placeholders.city')}
                error={errors.city?.message}
                {...register('city')}
              />

              <Textarea
                label={t('form.message')}
                placeholder={t('placeholders.message')}
                rows={4}
                error={errors.message?.message}
                {...register('message')}
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
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{t('form.error')}</span>
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
      <MaintenanceModal
        isOpen={isMaintenanceOpen}
        onClose={() => setIsMaintenanceOpen(false)}
      />
    </section>
  );
}

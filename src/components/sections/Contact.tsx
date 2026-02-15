'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, MessageCircle, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { Button, Input, Textarea, Select } from '@/components/ui';
import WhatsAppRegionModal from '@/components/ui/WhatsAppRegionModal';
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
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // In production, you would send this to your API
      console.log('Form submitted:', data);

      setSubmitStatus('success');
      reset();

      // Reset status after 3 seconds
      setTimeout(() => setSubmitStatus('idle'), 3000);
    } catch (error) {
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
                placeholder={isArabic ? 'أدخلي اسمك الكامل' : 'Enter your full name'}
                error={errors.name?.message}
                {...register('name')}
              />

              <div className="grid sm:grid-cols-2 gap-5">
                <Input
                  label={t('form.email')}
                  type="email"
                  placeholder={isArabic ? 'example@email.com' : 'example@email.com'}
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Input
                  label={t('form.phone')}
                  type="tel"
                  placeholder="05XXXXXXXX"
                  dir="ltr"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
              </div>

              <Select
                label={t('form.city')}
                options={cityOptions}
                placeholder={isArabic ? 'اختاري المدينة' : 'Select city'}
                error={errors.city?.message}
                {...register('city')}
              />

              <Textarea
                label={t('form.message')}
                placeholder={isArabic ? 'اكتبي رسالتك هنا...' : 'Write your message here...'}
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
                    {isArabic ? 'الرد خلال دقائق' : 'Response within minutes'}
                  </p>
                </div>
              </div>
              <Button
                variant="whatsapp"
                className="w-full"
                onClick={handleWhatsAppClick}
              >
                <MessageCircle className="w-5 h-5" />
                {isArabic ? 'ابدئي المحادثة' : 'Start Chat'}
              </Button>
            </div>

            {/* Contact Numbers */}
            <div className="bg-cream rounded-2xl p-6">
              <h3 className="font-semibold text-navy text-lg mb-4">
                {isArabic ? 'أرقام التواصل' : 'Contact Numbers'}
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
                {isArabic ? 'ساعات العمل' : 'Business Hours'}
              </h3>
              <p className="text-navy/70">
                {isArabic
                  ? 'السبت - الخميس: 9 صباحاً - 9 مساءً'
                  : 'Saturday - Thursday: 9 AM - 9 PM'}
              </p>
              <p className="text-navy/70">
                {isArabic
                  ? 'الجمعة: 4 مساءً - 9 مساءً'
                  : 'Friday: 4 PM - 9 PM'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <WhatsAppRegionModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
      />
    </section>
  );
}

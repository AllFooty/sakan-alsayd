'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  X,
  MapPin,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Send,
  Building2,
  Wrench,
  Camera,
} from 'lucide-react';
import { usePublicBuildings } from '@/components/providers/PublicBuildingsProvider';
import { cn, SAUDI_PHONE_REGEX } from '@/lib/utils';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { classifyError, type SubmitErrorKind } from '@/lib/errors/catalog';
import FieldError from '@/components/admin/shared/FieldError';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUMMARY_MAX = 150;

const maintenanceSchema = z.object({
  category: z.enum(['plumbing', 'electrical', 'furniture', 'hvac', 'general']),
  description: z.string().min(3, 'required').max(SUMMARY_MAX, 'tooLong'),
  extra_details: z.string().max(2000).optional(),
  room_number: z.string().optional(),
  apartment_number: z.string().optional(),
  is_apartment_shared: z.boolean().optional(),
  requester_name: z.string().min(2, 'required'),
  requester_phone: z.string().regex(SAUDI_PHONE_REGEX, 'invalidPhone'),
});

type MaintenanceFormData = z.infer<typeof maintenanceSchema>;

type Step = 'building' | 'details' | 'info';

const STEPS: Step[] = ['building', 'details', 'info'];

const CATEGORIES = ['plumbing', 'electrical', 'furniture', 'hvac', 'general'] as const;

export default function MaintenanceModal({ isOpen, onClose }: MaintenanceModalProps) {
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const t = useTranslations('maintenanceModal');
  const tErr = useTranslations('errors.submitFailure');

  const { buildings, cities } = usePublicBuildings();

  const [selectedCity, setSelectedCity] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>('building');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitErrorKind, setSubmitErrorKind] = useState<SubmitErrorKind>('unknown');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photosPreviews, setPhotosPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const scrimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  // City selection sub-step within 'building' step
  const [citySelected, setCitySelected] = useState(false);
  // Apartment-shared issue toggle (kitchen, hallway AC, water heater, etc.)
  // When true the room_number field is hidden; the apartment_number field
  // takes its place as a hint for the maintenance manager.
  const [isApartmentShared, setIsApartmentShared] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
    setValue,
    setFocus,
    trigger,
    watch,
  } = useForm<MaintenanceFormData>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      category: undefined,
    },
  });

  const selectedCategory = watch('category');

  const handlePhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 3 - selectedPhotos.length;
    const newFiles = files.slice(0, remaining);

    // Validate each file
    const validFiles = newFiles.filter(
      (f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 5 * 1024 * 1024
    );

    const updated = [...selectedPhotos, ...validFiles];
    setSelectedPhotos(updated);

    // Generate previews
    const newPreviews = validFiles.map((f) => URL.createObjectURL(f));
    setPhotosPreviews((prev) => [...prev, ...newPreviews]);

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photosPreviews[index]);
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotosPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setSelectedCity('');
      setSelectedLocationId('');
      setCitySelected(false);
      setIsApartmentShared(false);
      setCurrentStep('building');
      setSubmitStatus('idle');
      resetForm();
      // Clean up photo previews
      photosPreviews.forEach((url) => URL.revokeObjectURL(url));
      setSelectedPhotos([]);
      setPhotosPreviews([]);
    }, 300);
  }, [onClose, resetForm, photosPreviews]);

  // Keyboard + iOS-safe scroll lock. See BookingModal.tsx for the full
  // rationale — short version: pin <body> with position:fixed + negative top
  // offset so iOS Safari can't scroll <html> when an input is focused, which
  // is what was making the modal disappear off the top of the screen.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);

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
      document.removeEventListener('keydown', handleKey);
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.width = prevBodyWidth;
      document.body.style.overflow = prevBodyOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, handleClose]);

  // Visual viewport tracking — see BookingModal for the rationale.
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const el = scrimRef.current;
      if (!el) return;
      el.style.top = `${vv.offsetTop}px`;
      el.style.left = `${vv.offsetLeft}px`;
      el.style.width = `${vv.width}px`;
      el.style.height = `${vv.height}px`;
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [isOpen]);

  const selectedLocation = useMemo(
    () => buildings.find((l) => l.id === selectedLocationId),
    [selectedLocationId, buildings]
  );

  const cityBuildings = useMemo(
    () => buildings.filter((l) => l.city.toLowerCase() === selectedCity),
    [selectedCity, buildings]
  );

  const stepIndex = STEPS.indexOf(currentStep);

  const handleCitySelect = (city: string) => {
    setSelectedCity(city.toLowerCase());
    setSelectedLocationId('');
    const cityMatches = buildings.filter((l) => l.city.toLowerCase() === city.toLowerCase());
    if (cityMatches.length === 1) {
      setSelectedLocationId(cityMatches[0].id);
      setCitySelected(true);
      setCurrentStep('details');
    } else {
      setCitySelected(true);
    }
  };

  const handleBuildingSelect = (locationId: string) => {
    setSelectedLocationId(locationId);
    setCurrentStep('details');
  };

  const handleBack = () => {
    if (currentStep === 'details') {
      // Go back to building selection
      if (cityBuildings.length <= 1) {
        // Only one building, go back to city
        setCitySelected(false);
        setSelectedCity('');
        setSelectedLocationId('');
      } else {
        setSelectedLocationId('');
      }
      setCurrentStep('building');
    } else if (currentStep === 'info') {
      setCurrentStep('details');
    }
  };

  const handleDetailsNext = async () => {
    // Validate via RHF so errors are populated and the screen reader gets a
    // chance to announce them through the FieldError live regions.
    const valid = await trigger(['category', 'description']);
    if (!valid) {
      try {
        if (!selectedCategory) {
          // Category is a button-group (no input to focus). Move focus to
          // the group container so screen readers re-announce the labelled
          // group + the linked error message, and so keyboard users can
          // Tab into the option buttons immediately.
          document.getElementById('maintenance-category-group')?.focus();
        } else {
          setFocus('description');
        }
      } catch {
        // ignore
      }
      return;
    }
    setCurrentStep('info');
  };

  const onSubmit = async (data: MaintenanceFormData) => {
    setSubmitStatus('loading');
    let res: Response | undefined;
    try {
      const loc = selectedLocation;
      if (!loc) throw new Error('No building selected');

      // Upload photos first (if any), non-blocking on individual failures
      let photoPaths: string[] = [];
      if (selectedPhotos.length > 0) {
        try {
          const uploadPromises = selectedPhotos.map(async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await fetch('/api/uploads/maintenance-photo', {
              method: 'POST',
              body: formData,
            });
            if (uploadRes.ok) {
              const { path } = await uploadRes.json();
              return path as string;
            }
            return null;
          });
          photoPaths = (await Promise.all(uploadPromises)).filter(Boolean) as string[];
        } catch {
          // Don't block submission if photo upload fails
        }
      }

      const requestBody: Record<string, unknown> = {
        requester_name: data.requester_name,
        requester_phone: data.requester_phone,
        building_slug: loc.id,
        // For apartment-shared issues we send apartment_number (a free-text
        // hint) and the is_apartment_shared flag — the API resolves the
        // apartment_id when the hint matches a real apartment, otherwise
        // it lands as a building-level shared-area request.
        room_number: isApartmentShared ? null : data.room_number || null,
        apartment_number: isApartmentShared
          ? data.apartment_number || null
          : null,
        is_apartment_shared: isApartmentShared,
        category: data.category,
        description: data.description,
        extra_details: data.extra_details || null,
      };

      if (photoPaths.length > 0) {
        requestBody.photos = photoPaths;
      }

      res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) throw new Error('Failed');
      setSubmitStatus('success');
    } catch (err) {
      setSubmitErrorKind(classifyError({ res, err }));
      setSubmitStatus('error');
    }
  };

  if (!isOpen) return null;
  if (!mounted) return null;

  const BackIcon = isArabic ? ChevronRight : ChevronLeft;
  const showBack = (currentStep === 'building' && citySelected) || stepIndex > 0;

  const modalNode = (
    <FocusLock returnFocus={{ preventScroll: true }}>
    <div
      ref={scrimRef}
      role="dialog"
      aria-modal="true"
      aria-label={submitStatus === 'success' ? t('success.title') : t('title')}
      className="fixed z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      style={{ top: 0, left: 0, width: '100%', height: '100%' }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={cn(
          'relative bg-white dark:bg-[var(--admin-surface)] w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl',
          'max-h-[90dvh] sm:max-h-[85vh] flex flex-col',
          'transition-transform duration-300'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[var(--admin-border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            {showBack && submitStatus !== 'success' && (
              <button
                onClick={currentStep === 'building' && citySelected
                  ? () => { setCitySelected(false); setSelectedCity(''); setSelectedLocationId(''); }
                  : handleBack}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:bg-[var(--admin-surface-2)] transition-colors"
              >
                <BackIcon size={20} className="text-gray-600 dark:text-[var(--admin-text-muted)]" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold text-navy dark:text-[var(--admin-text)]">
                {submitStatus === 'success' ? t('success.title') : t('title')}
              </h2>
              {submitStatus !== 'success' && (
                <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">
                  {currentStep === 'building'
                    ? t('steps.building.title')
                    : t(`steps.${currentStep}.title`)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:bg-[var(--admin-surface-2)] transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
          </button>
        </div>

        {/* Progress bar */}
        {submitStatus !== 'success' && (
          <div className="flex gap-1 px-5 pt-3 flex-shrink-0">
            {STEPS.map((step, i) => (
              <div
                key={step}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  i <= stepIndex ? 'bg-coral' : 'bg-gray-200 dark:bg-[var(--admin-border)]'
                )}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Success State */}
          {submitStatus === 'success' ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-navy dark:text-[var(--admin-text)] mb-2">
                {t('success.heading')}
              </h3>
              <p className="text-gray-600 dark:text-[var(--admin-text-muted)] mb-6 max-w-sm">
                {t('success.description')}
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2.5 bg-coral text-white font-medium rounded-xl hover:bg-coral/90 transition-colors"
              >
                {t('success.close')}
              </button>
            </div>
          ) : currentStep === 'building' && !citySelected ? (
            /* City Selection */
            <div className="space-y-2">
              {cities.map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleCitySelect(city.name)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                    selectedCity === city.name.toLowerCase()
                      ? 'border-coral bg-coral/5 dark:bg-coral/10'
                      : 'border-gray-200 dark:border-[var(--admin-border)] hover:border-coral/50 hover:bg-gray-50 dark:bg-[var(--admin-bg)]'
                  )}
                >
                  <div className="w-11 h-11 rounded-xl bg-coral/10 flex items-center justify-center flex-shrink-0">
                    <MapPin size={20} className="text-coral" />
                  </div>
                  <div className="text-start flex-1">
                    <p className="font-semibold text-navy dark:text-[var(--admin-text)]">
                      {isArabic ? city.nameAr : city.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">
                      {buildings.filter((l) => l.city === city.name).length}{' '}
                      {t('steps.building.buildings')}
                    </p>
                  </div>
                  <div className="text-gray-400 dark:text-[var(--admin-text-subtle)]">
                    {isArabic ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                  </div>
                </button>
              ))}
            </div>
          ) : currentStep === 'building' && citySelected ? (
            /* Building Selection */
            <div className="space-y-2">
              {cityBuildings.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => handleBuildingSelect(loc.id)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                    selectedLocationId === loc.id
                      ? 'border-coral bg-coral/5 dark:bg-coral/10'
                      : 'border-gray-200 dark:border-[var(--admin-border)] hover:border-coral/50 hover:bg-gray-50 dark:bg-[var(--admin-bg)]'
                  )}
                >
                  <div className="w-11 h-11 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} className="text-navy dark:text-[var(--admin-text)]" />
                  </div>
                  <div className="text-start flex-1">
                    <p className="font-semibold text-navy dark:text-[var(--admin-text)]">
                      {isArabic ? loc.neighborhoodAr : loc.neighborhood}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">
                      {isArabic ? loc.cityAr : loc.city}
                    </p>
                  </div>
                  <div className="text-gray-400 dark:text-[var(--admin-text-subtle)]">
                    {isArabic ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                  </div>
                </button>
              ))}
            </div>
          ) : currentStep === 'details' ? (
            /* Issue Details */
            <div className="space-y-4">
              {/* Building summary */}
              <div className="bg-gray-50 dark:bg-[var(--admin-bg)] rounded-xl p-3.5">
                <div className="flex items-center gap-3">
                  <Building2 size={18} className="text-navy dark:text-[var(--admin-text)] flex-shrink-0" />
                  <div>
                    <p className="font-medium text-navy dark:text-[var(--admin-text)] text-sm">
                      {selectedLocation && (isArabic ? selectedLocation.neighborhoodAr : selectedLocation.neighborhood)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">
                      {selectedLocation && (isArabic ? selectedLocation.cityAr : selectedLocation.city)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Category */}
              <div>
                <label
                  id="maintenance-category-label"
                  className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-2 block"
                >
                  {t('steps.details.category')} *
                </label>
                <div
                  id="maintenance-category-group"
                  role="group"
                  tabIndex={-1}
                  aria-labelledby="maintenance-category-label"
                  aria-describedby={errors.category ? 'maintenance-category-error' : undefined}
                  className="grid grid-cols-3 gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 rounded-xl"
                >
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={selectedCategory === cat}
                      onClick={() => setValue('category', cat, { shouldValidate: true })}
                      className={cn(
                        'p-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                        selectedCategory === cat
                          ? 'border-coral bg-coral/5 dark:bg-coral/10 text-coral'
                          : 'border-gray-200 dark:border-[var(--admin-border)] text-gray-600 dark:text-[var(--admin-text-muted)] hover:border-coral/50'
                      )}
                    >
                      {t(`categories.${cat}`)}
                    </button>
                  ))}
                </div>
                <FieldError
                  id="maintenance-category-error"
                  message={errors.category ? t('errors.required') : undefined}
                />
              </div>

              {/* Summary */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)]">
                    {t('steps.details.summary')} *
                  </label>
                  <span className={cn(
                    'text-xs tabular-nums',
                    (watch('description')?.length || 0) > SUMMARY_MAX ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-[var(--admin-text-subtle)]'
                  )} dir="ltr">
                    {watch('description')?.length || 0} / {SUMMARY_MAX}
                  </span>
                </div>
                <textarea
                  id="maintenance-description"
                  {...register('description')}
                  rows={2}
                  maxLength={SUMMARY_MAX}
                  placeholder={t('steps.details.summaryPlaceholder')}
                  aria-invalid={!!errors.description}
                  aria-describedby={errors.description ? 'maintenance-description-error' : undefined}
                  className={cn(
                    'w-full px-4 py-2.5 border rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral resize-none transition-colors',
                    errors.description ? 'border-red-400' : 'border-gray-200 dark:border-[var(--admin-border)]'
                  )}
                />
                <FieldError
                  id="maintenance-description-error"
                  message={
                    errors.description
                      ? errors.description.message === 'tooLong'
                        ? t('errors.tooLong')
                        : t('errors.required')
                      : undefined
                  }
                />
              </div>

              {/* Extra Details (optional) */}
              <div>
                <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1 block">
                  {t('steps.details.extraDetails')}
                </label>
                <textarea
                  {...register('extra_details')}
                  rows={4}
                  placeholder={t('steps.details.extraDetailsPlaceholder')}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-[var(--admin-border)] rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral resize-none transition-colors"
                />
              </div>

              {/* Where: room vs apartment-shared toggle */}
              <div>
                <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-2 block">
                  {t('steps.details.locationLabel')}
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setIsApartmentShared(false)}
                    className={cn(
                      'p-2.5 rounded-xl border-2 text-sm font-medium transition-all text-start',
                      !isApartmentShared
                        ? 'border-coral bg-coral/5 dark:bg-coral/10 text-coral'
                        : 'border-gray-200 dark:border-[var(--admin-border)] text-gray-600 dark:text-[var(--admin-text-muted)] hover:border-coral/50'
                    )}
                  >
                    {t('steps.details.locationRoom')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsApartmentShared(true)}
                    className={cn(
                      'p-2.5 rounded-xl border-2 text-sm font-medium transition-all text-start',
                      isApartmentShared
                        ? 'border-coral bg-coral/5 dark:bg-coral/10 text-coral'
                        : 'border-gray-200 dark:border-[var(--admin-border)] text-gray-600 dark:text-[var(--admin-text-muted)] hover:border-coral/50'
                    )}
                  >
                    {t('steps.details.locationShared')}
                  </button>
                </div>
                {!isApartmentShared ? (
                  <input
                    {...register('room_number')}
                    placeholder={t('steps.details.roomNumberPlaceholder')}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-[var(--admin-border)] rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors"
                  />
                ) : (
                  <>
                    <input
                      {...register('apartment_number')}
                      placeholder={t('steps.details.apartmentNumberPlaceholder')}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-[var(--admin-border)] rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors"
                      dir="ltr"
                    />
                    <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-1.5">
                      {t('steps.details.apartmentNumberHelper')}
                    </p>
                  </>
                )}
              </div>

              {/* Photos */}
              <div>
                <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1 block">
                  {t('photos')}
                </label>
                <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-2">{t('photosHint')}</p>

                {/* Thumbnails */}
                {photosPreviews.length > 0 && (
                  <div className="flex gap-2 mb-2">
                    {photosPreviews.map((src, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-[var(--admin-border)] group">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedPhotos.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-[var(--admin-border)] rounded-xl text-sm text-gray-500 dark:text-[var(--admin-text-muted)] hover:border-coral hover:text-coral transition-colors"
                  >
                    <Camera size={16} />
                    <span>{selectedPhotos.length === 0 ? t('photos') : `${selectedPhotos.length}/3`}</span>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handlePhotosChange}
                  className="hidden"
                />
              </div>
            </div>
          ) : (
            /* Contact Info */
            <div>
              {/* Summary */}
              <div className="bg-gray-50 dark:bg-[var(--admin-bg)] rounded-xl p-3.5 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-[var(--admin-text-muted)] text-xs">{t('placeholders.building')}</p>
                    <p className="font-medium text-navy dark:text-[var(--admin-text)]">
                      {selectedLocation && (isArabic ? selectedLocation.neighborhoodAr : selectedLocation.neighborhood)}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-gray-500 dark:text-[var(--admin-text-muted)] text-xs">{t('steps.details.category')}</p>
                    <p className="font-medium text-coral">
                      {selectedCategory && t(`categories.${selectedCategory}`)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-[var(--admin-border)]">
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('steps.details.summary')}</p>
                  <p className="text-sm font-medium text-navy dark:text-[var(--admin-text)] whitespace-pre-wrap">{watch('description')}</p>
                  {watch('extra_details') && (
                    <>
                      <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-2">{t('steps.details.extraDetails')}</p>
                      <p className="text-sm text-gray-700 dark:text-[var(--admin-text-muted)] whitespace-pre-wrap">{watch('extra_details')}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" id="maintenance-form">
                <div>
                  <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1 block">
                    {t('steps.info.name')} *
                  </label>
                  <input
                    id="maintenance-requester-name"
                    {...register('requester_name')}
                    placeholder={t('placeholders.fullName')}
                    aria-invalid={!!errors.requester_name}
                    aria-describedby={
                      errors.requester_name ? 'maintenance-requester-name-error' : undefined
                    }
                    className={cn(
                      'w-full px-4 py-2.5 border rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors',
                      errors.requester_name ? 'border-red-400' : 'border-gray-200 dark:border-[var(--admin-border)]'
                    )}
                  />
                  <FieldError
                    id="maintenance-requester-name-error"
                    message={errors.requester_name ? t('errors.required') : undefined}
                  />
                </div>

                <div>
                  <PhoneInput
                    id="maintenance-phone"
                    label={`${t('steps.info.phone')} *`}
                    {...register('requester_phone')}
                    placeholder={t('placeholders.phone')}
                    formatHint={t('phoneHint')}
                    error={errors.requester_phone ? t('invalidPhone') : undefined}
                    className={cn(
                      'w-full px-4 py-2.5 border rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors',
                      errors.requester_phone ? 'border-red-400' : 'border-gray-200 dark:border-[var(--admin-border)]'
                    )}
                  />
                </div>

                {submitStatus === 'error' && (
                  <div className="flex items-start gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl text-sm" role="alert">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p>{tErr(submitErrorKind)}</p>
                      <button
                        type="button"
                        onClick={() => handleSubmit(onSubmit)()}
                        className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 underline underline-offset-2"
                      >
                        <RotateCcw size={14} />
                        {tErr('retry')}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        {submitStatus !== 'success' && currentStep === 'details' && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-[var(--admin-border)] flex-shrink-0">
            <button
              type="button"
              onClick={handleDetailsNext}
              disabled={!selectedCategory || !watch('description') || watch('description').length < 3 || watch('description').length > SUMMARY_MAX}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-coral text-white font-semibold rounded-xl hover:bg-coral/90 disabled:opacity-60 transition-colors shadow-lg shadow-coral/25"
            >
              {t('next')}
              {isArabic ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        )}

        {currentStep === 'info' && submitStatus !== 'success' && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-[var(--admin-border)] flex-shrink-0">
            <button
              type="submit"
              form="maintenance-form"
              disabled={submitStatus === 'loading'}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-coral text-white font-semibold rounded-xl hover:bg-coral/90 disabled:opacity-60 transition-colors shadow-lg shadow-coral/25"
            >
              {submitStatus === 'loading' ? (
                <span>{t('submitting')}</span>
              ) : (
                <>
                  <Send size={18} />
                  <span>{t('submit')}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Mobile bottom safe area (iPhone home indicator) */}
        <div className="pb-[env(safe-area-inset-bottom)] sm:hidden" />
      </div>
    </div>
    </FocusLock>
  );

  return createPortal(modalNode, document.body);
}

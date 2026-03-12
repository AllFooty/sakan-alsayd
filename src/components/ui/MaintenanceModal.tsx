'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Send,
  Building2,
  Wrench,
  Camera,
} from 'lucide-react';
import { locations, getCities } from '@/data/locations';
import { cn } from '@/lib/utils';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const maintenanceSchema = z.object({
  category: z.enum(['plumbing', 'electrical', 'furniture', 'cleaning', 'hvac', 'general']),
  title: z.string().min(3, 'required'),
  description: z.string().optional(),
  room_number: z.string().optional(),
  requester_name: z.string().min(2, 'required'),
  requester_phone: z.string().min(9, 'required'),
});

type MaintenanceFormData = z.infer<typeof maintenanceSchema>;

type Step = 'building' | 'details' | 'info';

const STEPS: Step[] = ['building', 'details', 'info'];

const CATEGORIES = ['plumbing', 'electrical', 'furniture', 'cleaning', 'hvac', 'general'] as const;

export default function MaintenanceModal({ isOpen, onClose }: MaintenanceModalProps) {
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const t = useTranslations('maintenanceModal');

  const cities = useMemo(() => getCities(), []);

  const [selectedCity, setSelectedCity] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>('building');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photosPreviews, setPhotosPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // City selection sub-step within 'building' step
  const [citySelected, setCitySelected] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
    setValue,
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
      setCurrentStep('building');
      setSubmitStatus('idle');
      resetForm();
      // Clean up photo previews
      photosPreviews.forEach((url) => URL.revokeObjectURL(url));
      setSelectedPhotos([]);
      setPhotosPreviews([]);
    }, 300);
  }, [onClose, resetForm, photosPreviews]);

  // Keyboard
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleClose]);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId),
    [selectedLocationId]
  );

  const cityBuildings = useMemo(
    () => locations.filter((l) => l.city.toLowerCase() === selectedCity),
    [selectedCity]
  );

  const stepIndex = STEPS.indexOf(currentStep);

  const handleCitySelect = (city: string) => {
    setSelectedCity(city.toLowerCase());
    setSelectedLocationId('');
    const buildings = locations.filter((l) => l.city.toLowerCase() === city.toLowerCase());
    if (buildings.length === 1) {
      setSelectedLocationId(buildings[0].id);
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

  const handleDetailsNext = () => {
    // Validate category and title before proceeding
    if (!selectedCategory || !watch('title') || watch('title').length < 3) return;
    setCurrentStep('info');
  };

  const onSubmit = async (data: MaintenanceFormData) => {
    setSubmitStatus('loading');
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
        room_number: data.room_number || null,
        category: data.category,
        title: data.title,
        description: data.description || null,
      };

      if (photoPaths.length > 0) {
        requestBody.photos = photoPaths;
      }

      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) throw new Error('Failed');
      setSubmitStatus('success');
    } catch {
      setSubmitStatus('error');
    }
  };

  if (!isOpen) return null;

  const BackIcon = isArabic ? ChevronRight : ChevronLeft;
  const showBack = (currentStep === 'building' && citySelected) || stepIndex > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={cn(
          'relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl',
          'max-h-[90dvh] sm:max-h-[85vh] flex flex-col',
          'transition-transform duration-300'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {showBack && submitStatus !== 'success' && (
              <button
                onClick={currentStep === 'building' && citySelected
                  ? () => { setCitySelected(false); setSelectedCity(''); setSelectedLocationId(''); }
                  : handleBack}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <BackIcon size={20} className="text-gray-600" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold text-navy">
                {submitStatus === 'success' ? t('success.title') : t('title')}
              </h2>
              {submitStatus !== 'success' && (
                <p className="text-xs text-gray-500">
                  {currentStep === 'building'
                    ? t('steps.building.title')
                    : t(`steps.${currentStep}.title`)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-500" />
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
                  i <= stepIndex ? 'bg-coral' : 'bg-gray-200'
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
              <h3 className="text-xl font-bold text-navy mb-2">
                {t('success.heading')}
              </h3>
              <p className="text-gray-600 mb-6 max-w-sm">
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
                      ? 'border-coral bg-coral/5'
                      : 'border-gray-200 hover:border-coral/50 hover:bg-gray-50'
                  )}
                >
                  <div className="w-11 h-11 rounded-xl bg-coral/10 flex items-center justify-center flex-shrink-0">
                    <MapPin size={20} className="text-coral" />
                  </div>
                  <div className="text-start flex-1">
                    <p className="font-semibold text-navy">
                      {isArabic ? city.nameAr : city.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {locations.filter((l) => l.city === city.name).length}{' '}
                      {t('steps.building.buildings')}
                    </p>
                  </div>
                  <div className="text-gray-400">
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
                      ? 'border-coral bg-coral/5'
                      : 'border-gray-200 hover:border-coral/50 hover:bg-gray-50'
                  )}
                >
                  <div className="w-11 h-11 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} className="text-navy" />
                  </div>
                  <div className="text-start flex-1">
                    <p className="font-semibold text-navy">
                      {isArabic ? loc.neighborhoodAr : loc.neighborhood}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isArabic ? loc.cityAr : loc.city}
                    </p>
                  </div>
                  <div className="text-gray-400">
                    {isArabic ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                  </div>
                </button>
              ))}
            </div>
          ) : currentStep === 'details' ? (
            /* Issue Details */
            <div className="space-y-4">
              {/* Building summary */}
              <div className="bg-gray-50 rounded-xl p-3.5">
                <div className="flex items-center gap-3">
                  <Building2 size={18} className="text-navy flex-shrink-0" />
                  <div>
                    <p className="font-medium text-navy text-sm">
                      {selectedLocation && (isArabic ? selectedLocation.neighborhoodAr : selectedLocation.neighborhood)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedLocation && (isArabic ? selectedLocation.cityAr : selectedLocation.city)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-medium text-navy mb-2 block">
                  {t('steps.details.category')} *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setValue('category', cat, { shouldValidate: true })}
                      className={cn(
                        'p-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                        selectedCategory === cat
                          ? 'border-coral bg-coral/5 text-coral'
                          : 'border-gray-200 text-gray-600 hover:border-coral/50'
                      )}
                    >
                      {t(`categories.${cat}`)}
                    </button>
                  ))}
                </div>
                {errors.category && (
                  <p className="text-red-500 text-xs mt-1">{t('steps.details.categoryPlaceholder')}</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {t('steps.details.issueTitle')} *
                </label>
                <input
                  {...register('title')}
                  placeholder={t('steps.details.issueTitlePlaceholder')}
                  className={cn(
                    'w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors',
                    errors.title ? 'border-red-400' : 'border-gray-200'
                  )}
                />
              </div>

              {/* Room Number */}
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {t('steps.details.roomNumber')}
                </label>
                <input
                  {...register('room_number')}
                  placeholder={t('steps.details.roomNumberPlaceholder')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {t('steps.details.description')}
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder={t('steps.details.descriptionPlaceholder')}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral resize-none transition-colors"
                />
              </div>

              {/* Photos */}
              <div>
                <label className="text-sm font-medium text-navy mb-1 block">
                  {t('photos')}
                </label>
                <p className="text-xs text-gray-500 mb-2">{t('photosHint')}</p>

                {/* Thumbnails */}
                {photosPreviews.length > 0 && (
                  <div className="flex gap-2 mb-2">
                    {photosPreviews.map((src, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
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
                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-coral hover:text-coral transition-colors"
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
              <div className="bg-gray-50 rounded-xl p-3.5 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">{t('placeholders.building')}</p>
                    <p className="font-medium text-navy">
                      {selectedLocation && (isArabic ? selectedLocation.neighborhoodAr : selectedLocation.neighborhood)}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-gray-500 text-xs">{t('steps.details.category')}</p>
                    <p className="font-medium text-coral">
                      {selectedCategory && t(`categories.${selectedCategory}`)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500">{t('steps.details.issueTitle')}</p>
                  <p className="text-sm font-medium text-navy">{watch('title')}</p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" id="maintenance-form">
                <div>
                  <label className="text-sm font-medium text-navy mb-1 block">
                    {t('steps.info.name')} *
                  </label>
                  <input
                    {...register('requester_name')}
                    placeholder={t('placeholders.fullName')}
                    className={cn(
                      'w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors',
                      errors.requester_name ? 'border-red-400' : 'border-gray-200'
                    )}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-navy mb-1 block">
                    {t('steps.info.phone')} *
                  </label>
                  <input
                    {...register('requester_phone')}
                    type="tel"
                    dir="ltr"
                    placeholder={t('placeholders.phone')}
                    className={cn(
                      'w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors',
                      errors.requester_phone ? 'border-red-400' : 'border-gray-200'
                    )}
                  />
                </div>

                {submitStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <span>{t('error')}</span>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        {submitStatus !== 'success' && currentStep === 'details' && (
          <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              type="button"
              onClick={handleDetailsNext}
              disabled={!selectedCategory || !watch('title') || watch('title').length < 3}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-coral text-white font-semibold rounded-xl hover:bg-coral/90 disabled:opacity-60 transition-colors shadow-lg shadow-coral/25"
            >
              {t('next')}
              {isArabic ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        )}

        {currentStep === 'info' && submitStatus !== 'success' && (
          <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
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

        {/* Mobile bottom safe area */}
        <div className="h-safe-bottom sm:hidden" />
      </div>
    </div>
  );
}

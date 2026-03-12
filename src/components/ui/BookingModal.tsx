'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  X,
  MapPin,
  Home,
  User,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Send,
  Bath,
  Users,
  Users2,
  DoorOpen,
  Building2,
} from 'lucide-react';
import { locations, getCities } from '@/data/locations';
import { formatPrice, cn } from '@/lib/utils';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselected?: {
    locationId?: string;
    roomType?: string;
    bathroomType?: string;
  };
}

const bookingSchema = z.object({
  name: z.string().min(2, 'required'),
  email: z.string().email('invalid'),
  phone: z.string().min(9, 'required'),
  notes: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

type Step = 'city' | 'building' | 'room' | 'info';

const STEPS: Step[] = ['city', 'building', 'room', 'info'];

const roomTypeIcons: Record<string, React.ElementType> = {
  single: User,
  double: Users,
  triple: Users2,
  suite: DoorOpen,
};

export default function BookingModal({
  isOpen,
  onClose,
  preselected,
}: BookingModalProps) {
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const t = useTranslations('bookingModal');
  const tRooms = useTranslations('rooms');

  const cities = useMemo(() => getCities(), []);

  // Selection state
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<{ type: string; bathroomType: string; price: number } | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('city');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
  });

  // Handle preselected values — only trigger when modal opens
  const preselectedLocationId = preselected?.locationId;
  const preselectedRoomType = preselected?.roomType;
  const preselectedBathroomType = preselected?.bathroomType;

  useEffect(() => {
    if (!isOpen || !preselectedLocationId) return;

    const loc = locations.find((l) => l.id === preselectedLocationId);
    if (!loc) return;

    setSelectedCity(loc.city.toLowerCase());
    setSelectedLocationId(loc.id);

    if (preselectedRoomType && preselectedBathroomType) {
      const room = loc.roomPrices.find(
        (r) => r.type === preselectedRoomType && r.bathroomType === preselectedBathroomType
      );
      if (room) {
        setSelectedRoom({
          type: room.type,
          bathroomType: room.bathroomType,
          price: room.discountedPrice || room.monthlyPrice,
        });
        setCurrentStep('info');
        return;
      }
    }
    setCurrentStep('room');
  }, [isOpen, preselectedLocationId, preselectedRoomType, preselectedBathroomType]);

  // Reset on close
  const handleClose = useCallback(() => {
    onClose();
    // Delay reset so closing animation finishes
    setTimeout(() => {
      setSelectedCity('');
      setSelectedLocationId('');
      setSelectedRoom(null);
      setCurrentStep('city');
      setSubmitStatus('idle');
      resetForm();
    }, 300);
  }, [onClose, resetForm]);

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
    setSelectedRoom(null);
    // If only one building in city, auto-select it
    const buildings = locations.filter((l) => l.city.toLowerCase() === city.toLowerCase());
    if (buildings.length === 1) {
      setSelectedLocationId(buildings[0].id);
      setCurrentStep('room');
    } else {
      setCurrentStep('building');
    }
  };

  const handleBuildingSelect = (locationId: string) => {
    setSelectedLocationId(locationId);
    setSelectedRoom(null);
    setCurrentStep('room');
  };

  const handleRoomSelect = (type: string, bathroomType: string, price: number) => {
    setSelectedRoom({ type, bathroomType, price });
    setCurrentStep('info');
  };

  const handleBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      // Skip building step if city has only 1 building
      if (STEPS[prevIndex] === 'building' && cityBuildings.length <= 1) {
        setCurrentStep('city');
      } else {
        setCurrentStep(STEPS[prevIndex]);
      }
    }
  };

  const onSubmit = async (data: BookingFormData) => {
    setSubmitStatus('loading');
    try {
      const loc = selectedLocation;
      const roomLabel = selectedRoom
        ? `${tRooms(`types.${selectedRoom.type}`)} - ${tRooms(`bathroom.${selectedRoom.bathroomType}`)}`
        : '';
      const buildingLabel = loc
        ? `${isArabic ? loc.neighborhoodAr : loc.neighborhood}, ${isArabic ? loc.cityAr : loc.city}`
        : '';

      const message = [
        `${t('summary.building')}: ${buildingLabel}`,
        `${t('summary.room')}: ${roomLabel}`,
        selectedRoom ? `${t('summary.price')}: ${formatPrice(selectedRoom.price)} ${tRooms('pricePerMonth')}` : '',
        data.notes ? `\n${t('steps.info.notes')}: ${data.notes}` : '',
      ].filter(Boolean).join('\n');

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          city: selectedCity,
          message,
        }),
      });

      if (!res.ok) throw new Error('Failed');
      setSubmitStatus('success');
    } catch {
      setSubmitStatus('error');
    }
  };

  if (!isOpen) return null;

  const BackIcon = isArabic ? ChevronRight : ChevronLeft;

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
            {stepIndex > 0 && submitStatus !== 'success' && (
              <button
                onClick={handleBack}
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
                  {t(`steps.${currentStep}.title`)}
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
          ) : currentStep === 'city' ? (
            /* Step 1: City Selection */
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
                      {t('steps.city.buildings')}
                    </p>
                  </div>
                  <div className="text-gray-400">
                    {isArabic ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                  </div>
                </button>
              ))}
            </div>
          ) : currentStep === 'building' ? (
            /* Step 2: Building Selection */
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
                      {loc.roomPrices.length} {t('steps.building.rooms')}
                      {' · '}
                      {t('steps.building.from')} {formatPrice(Math.min(...loc.roomPrices.map((r) => r.discountedPrice || r.monthlyPrice)))} {t('currency')}
                    </p>
                  </div>
                  <div className="text-gray-400">
                    {isArabic ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                  </div>
                </button>
              ))}
            </div>
          ) : currentStep === 'room' ? (
            /* Step 3: Room Selection */
            <div className="space-y-2">
              {selectedLocation?.roomPrices.map((room) => {
                const RoomIcon = roomTypeIcons[room.type] || Home;
                const isSelected =
                  selectedRoom?.type === room.type &&
                  selectedRoom?.bathroomType === room.bathroomType;
                const price = room.discountedPrice || room.monthlyPrice;

                return (
                  <button
                    key={`${room.type}-${room.bathroomType}`}
                    onClick={() => handleRoomSelect(room.type, room.bathroomType, price)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all',
                      isSelected
                        ? 'border-coral bg-coral/5'
                        : 'border-gray-200 hover:border-coral/50 hover:bg-gray-50'
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <RoomIcon size={18} className="text-navy" />
                    </div>
                    <div className="text-start flex-1 min-w-0">
                      <p className="font-medium text-navy text-sm">
                        {tRooms(`types.${room.type}`)}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Bath size={12} />
                        <span className="truncate">{tRooms(`bathroom.${room.bathroomType}`)}</span>
                      </div>
                    </div>
                    <div className="text-end flex-shrink-0">
                      <p className="font-bold text-coral text-sm">
                        {formatPrice(price)}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {tRooms('pricePerMonth')}
                      </p>
                      {room.discountedPrice && (
                        <p className="text-[10px] text-gray-400 line-through">
                          {formatPrice(room.monthlyPrice)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Step 4: Personal Info */
            <div>
              {/* Selection summary */}
              <div className="bg-gray-50 rounded-xl p-3.5 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">{t('summary.building')}</p>
                    <p className="font-medium text-navy">
                      {selectedLocation && (
                        <>
                          {isArabic ? selectedLocation.neighborhoodAr : selectedLocation.neighborhood}
                          {', '}
                          {isArabic ? selectedLocation.cityAr : selectedLocation.city}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-gray-500 text-xs">{t('summary.room')}</p>
                    <p className="font-medium text-navy">
                      {selectedRoom && tRooms(`types.${selectedRoom.type}`)}
                    </p>
                  </div>
                </div>
                {selectedRoom && (
                  <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {selectedRoom && tRooms(`bathroom.${selectedRoom.bathroomType}`)}
                    </span>
                    <span className="font-bold text-coral">
                      {formatPrice(selectedRoom.price)} {tRooms('pricePerMonth')}
                    </span>
                  </div>
                )}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" id="booking-form">
                <div>
                  <label className="text-sm font-medium text-navy mb-1 block">
                    {t('steps.info.name')} *
                  </label>
                  <input
                    {...register('name')}
                    placeholder={t('placeholders.fullName')}
                    className={cn(
                      'w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors',
                      errors.name ? 'border-red-400' : 'border-gray-200'
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-navy mb-1 block">
                      {t('steps.info.email')} *
                    </label>
                    <input
                      {...register('email')}
                      type="email"
                      placeholder={t('placeholders.email')}
                      className={cn(
                        'w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors',
                        errors.email ? 'border-red-400' : 'border-gray-200'
                      )}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-navy mb-1 block">
                      {t('steps.info.phone')} *
                    </label>
                    <input
                      {...register('phone')}
                      type="tel"
                      dir="ltr"
                      placeholder={t('placeholders.phone')}
                      className={cn(
                        'w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors',
                        errors.phone ? 'border-red-400' : 'border-gray-200'
                      )}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-navy mb-1 block">
                    {t('steps.info.notes')}
                  </label>
                  <textarea
                    {...register('notes')}
                    rows={2}
                    placeholder={t('placeholders.notes')}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral resize-none transition-colors"
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

        {/* Footer - submit button on info step */}
        {currentStep === 'info' && submitStatus !== 'success' && (
          <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
            <button
              type="submit"
              form="booking-form"
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

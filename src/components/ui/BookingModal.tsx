'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import { useLocale, useTranslations } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
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
  RotateCcw,
  Send,
  Bath,
  Users,
  Users2,
  DoorOpen,
  Building2,
  Bus,
  BusFront,
} from 'lucide-react';
import { usePublicBuildings } from '@/components/providers/PublicBuildingsProvider';
import { formatPrice, cn, SAUDI_PHONE_REGEX } from '@/lib/utils';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { classifyError, type SubmitErrorKind } from '@/lib/errors/catalog';

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
  // personal
  name: z.string().min(2, 'required'),
  dateOfBirth: z.string().min(1, 'required'),
  occupation: z.enum(['employee', 'student', 'trainee', 'other'], {
    message: 'required',
  }),
  // contact
  email: z.string().email('invalid'),
  phone: z.string().regex(SAUDI_PHONE_REGEX, 'invalidPhone'),
  emergencyContactName: z.string().min(2, 'required'),
  emergencyContactPhone: z.string().regex(SAUDI_PHONE_REGEX, 'invalidPhone'),
  // logistics
  contractStartDate: z.string().min(1, 'required'),
  withTransportation: z.boolean(),
  // additional
  hasMedicalIssues: z.boolean(),
  medicalIssuesDescription: z.string().optional(),
  referralSource: z.string().min(1, 'required'),
  notes: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

type Step = 'city' | 'building' | 'room' | 'personal' | 'contact' | 'logistics' | 'additional';

const STEPS: Step[] = ['city', 'building', 'room', 'personal', 'contact', 'logistics', 'additional'];

const FORM_STEPS: Step[] = ['personal', 'contact', 'logistics', 'additional'];

const FIELDS_PER_STEP: Partial<Record<Step, (keyof BookingFormData)[]>> = {
  personal: ['name', 'dateOfBirth', 'occupation'],
  contact: ['email', 'phone', 'emergencyContactName', 'emergencyContactPhone'],
  logistics: ['contractStartDate', 'withTransportation'],
  additional: ['referralSource'],
};

const roomTypeIcons: Record<string, React.ElementType> = {
  single: User,
  double: Users,
  triple: Users2,
  suite: DoorOpen,
};

const OCCUPATION_OPTIONS = ['employee', 'student', 'trainee', 'other'] as const;

const REFERRAL_OPTIONS = ['twitter', 'instagram', 'snapchat', 'tiktok', 'friend', 'google', 'other'] as const;

export default function BookingModal({
  isOpen,
  onClose,
  preselected,
}: BookingModalProps) {
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const t = useTranslations('bookingModal');
  const tRooms = useTranslations('rooms');
  const tErr = useTranslations('errors.submitFailure');

  const { buildings, cities } = usePublicBuildings();

  // Selection state
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<{ type: string; bathroomType: string; price: number } | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('city');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitErrorKind, setSubmitErrorKind] = useState<SubmitErrorKind>('unknown');
  const [mounted, setMounted] = useState(false);
  const scrimRef = useRef<HTMLDivElement>(null);

  // Mark mounted so we only portal client-side. The component is loaded with
  // dynamic({ ssr: false }) so SSR isn't an issue, but this also gives us a
  // safe `document.body` reference.
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    register,
    handleSubmit,
    reset: resetForm,
    trigger,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      contractStartDate: '',
      withTransportation: false,
      hasMedicalIssues: false,
      notes: '',
      medicalIssuesDescription: '',
      referralSource: '',
    },
  });

  const watchHasMedicalIssues = watch('hasMedicalIssues');
  const watchOccupation = watch('occupation');
  const watchTransportation = watch('withTransportation');
  const watchDateOfBirth = watch('dateOfBirth');
  const watchContractStartDate = watch('contractStartDate');

  // Handle preselected values — only trigger when modal opens
  const preselectedLocationId = preselected?.locationId;
  const preselectedRoomType = preselected?.roomType;
  const preselectedBathroomType = preselected?.bathroomType;

  // Apply preselection exactly once per open. The `buildings` reference can
  // change underneath us (cache revalidation, router.refresh, etc.); without
  // this guard the effect re-runs and snaps the user back to 'personal' /
  // 'room', wiping any in-progress wizard state.
  const preselectAppliedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      preselectAppliedRef.current = false;
      return;
    }
    if (preselectAppliedRef.current || !preselectedLocationId) return;

    const loc = buildings.find((l) => l.id === preselectedLocationId);
    if (!loc) return;

    preselectAppliedRef.current = true;
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
        setCurrentStep('personal');
        return;
      }
    }
    setCurrentStep('room');
  }, [isOpen, preselectedLocationId, preselectedRoomType, preselectedBathroomType, buildings]);

  // Reset on close
  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setSelectedCity('');
      setSelectedLocationId('');
      setSelectedRoom(null);
      setCurrentStep('city');
      setSubmitStatus('idle');
      resetForm();
    }, 300);
  }, [onClose, resetForm]);

  // Keyboard + iOS-safe scroll lock. The naive overflow:hidden lock does NOT
  // stop iOS Safari from scrolling <html> to "bring the focused input into
  // view" — when that happens inside a position:fixed modal, the entire modal
  // scrolls off the top of the screen. The fix is to pin <body> in place with
  // position:fixed + a negative top offset so iOS has no document to scroll;
  // it then scrolls the modal's overflow-y-auto content instead, which keeps
  // the modal anchored. Restore scroll position on close.
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

  // Visual viewport tracking. CSS `position: fixed` is anchored to the LAYOUT
  // viewport, but on iOS Safari the layout viewport and the visual viewport
  // diverge while the keyboard is open — the result is a fixed modal that
  // appears to scroll off the top of the screen when an input is focused.
  // Pin the modal scrim to the visual viewport's box so the modal stays in
  // the user's actual visible area no matter what iOS does.
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
  const isFormStep = FORM_STEPS.includes(currentStep);
  const isLastStep = currentStep === 'additional';

  // Date limits
  const today = new Date().toISOString().split('T')[0];
  const maxDob = new Date();
  maxDob.setFullYear(maxDob.getFullYear() - 16);
  const maxDobStr = maxDob.toISOString().split('T')[0];

  const handleCitySelect = (city: string) => {
    setSelectedCity(city.toLowerCase());
    setSelectedLocationId('');
    setSelectedRoom(null);
    const cityMatches = buildings.filter((l) => l.city.toLowerCase() === city.toLowerCase());
    if (cityMatches.length === 1) {
      setSelectedLocationId(cityMatches[0].id);
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
    setCurrentStep('personal');
  };

  const handleBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      if (STEPS[prevIndex] === 'building' && cityBuildings.length <= 1) {
        setCurrentStep('city');
      } else {
        setCurrentStep(STEPS[prevIndex]);
      }
    }
  };

  const handleNext = async () => {
    const fields = FIELDS_PER_STEP[currentStep];
    if (fields) {
      const valid = await trigger(fields);
      if (!valid) return;
    }
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const onSubmit = async (data: BookingFormData) => {
    setSubmitStatus('loading');
    let res: Response | undefined;
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
        selectedRoom ? `${t('summary.insurance')}: ${formatPrice(500)} ${t('currency')}` : '',
        `${t('summary.transportation')}: ${data.withTransportation ? t('steps.logistics.withTransportation') : t('steps.logistics.withoutTransportation')}`,
        data.notes ? `\n${t('steps.additional.notes')}: ${data.notes}` : '',
      ].filter(Boolean).join('\n');

      res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          city: selectedCity,
          message,
          date_of_birth: data.dateOfBirth,
          occupation: data.occupation,
          emergency_contact_name: data.emergencyContactName,
          emergency_contact_phone: data.emergencyContactPhone,
          contract_start_date: data.contractStartDate,
          with_transportation: data.withTransportation,
          metadata: {
            medical_issues: {
              has_issues: data.hasMedicalIssues,
              description: data.medicalIssuesDescription || null,
            },
            referral_source: data.referralSource,
            room_type: selectedRoom?.type,
            bathroom_type: selectedRoom?.bathroomType,
            building_id: selectedLocationId,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed');
      setSubmitStatus('success');
    } catch (err) {
      setSubmitErrorKind(classifyError({ res, err }));
      setSubmitStatus('error');
    }
  };

  if (!isOpen) return null;

  const BackIcon = isArabic ? ChevronRight : ChevronLeft;

  const inputClassName = (hasError: boolean) =>
    cn(
      'w-full px-4 py-3 border rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral transition-colors',
      hasError ? 'border-red-400' : 'border-gray-200 dark:border-[var(--admin-border)]'
    );

  // Booking summary card (reused across form steps)
  const SummaryCard = () => (
    <div className="bg-gray-50 dark:bg-[var(--admin-bg)] rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between text-sm gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-gray-500 dark:text-[var(--admin-text-muted)] text-xs">{t('summary.building')}</p>
          <p className="font-medium text-navy dark:text-[var(--admin-text)] truncate">
            {selectedLocation && (
              <>
                {isArabic ? selectedLocation.neighborhoodAr : selectedLocation.neighborhood}
                {', '}
                {isArabic ? selectedLocation.cityAr : selectedLocation.city}
              </>
            )}
          </p>
        </div>
        <div className="text-end flex-shrink-0">
          <p className="text-gray-500 dark:text-[var(--admin-text-muted)] text-xs">{t('summary.room')}</p>
          <p className="font-medium text-navy dark:text-[var(--admin-text)]">
            {selectedRoom && tRooms(`types.${selectedRoom.type}`)}
          </p>
        </div>
      </div>
      {selectedRoom && (
        <>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-[var(--admin-border)] flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">
              {tRooms(`bathroom.${selectedRoom.bathroomType}`)}
            </span>
            <span className="font-bold text-coral">
              {formatPrice(selectedRoom.price)} {tRooms('pricePerMonth')}
            </span>
          </div>
          {/* Apartment context for the selected building. Reassures the
              student that the room sits inside a real apartment with shared
              amenities, without adding a step. */}
          {selectedLocation &&
            selectedLocation.apartmentSummary.count > 0 && (
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] inline-flex items-center gap-1">
                  <Home size={10} />
                  {t('summary.apartmentContext', {
                    apartments: selectedLocation.apartmentSummary.count,
                    floors: selectedLocation.apartmentSummary.floors,
                  })}
                </span>
                {selectedLocation.apartmentSummary.withKitchen ===
                  selectedLocation.apartmentSummary.count && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    {t('summary.sharedKitchen')}
                  </span>
                )}
              </div>
            )}
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">
              {t('summary.insurance')}
            </span>
            <span className="text-sm font-medium text-navy dark:text-[var(--admin-text)]">
              {formatPrice(500)} {t('currency')}
            </span>
          </div>
        </>
      )}
    </div>
  );

  if (!mounted) return null;

  const modalNode = (
    <FocusLock returnFocus>
    <div
      ref={scrimRef}
      role="dialog"
      aria-modal="true"
      aria-label={submitStatus === 'success' ? t('success.title') : t('title')}
      className="fixed z-[100] flex items-end sm:items-center justify-center bg-black/60"
      style={{ top: 0, left: 0, width: '100%', height: '100%' }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={cn(
          'relative bg-white dark:bg-[var(--admin-surface)] w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl',
          'max-h-[90dvh] sm:max-h-[85vh] flex flex-col'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[var(--admin-border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            {stepIndex > 0 && submitStatus !== 'success' && (
              <button
                onClick={handleBack}
                className="p-2.5 -m-1 rounded-lg hover:bg-gray-100 dark:bg-[var(--admin-surface-2)] transition-colors"
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
                  {t(`steps.${currentStep}.title`)}
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
          ) : currentStep === 'city' ? (
            /* Step 1: City Selection */
            <div className="space-y-2">
              {cities.map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleCitySelect(city.name)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-colors',
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
                      {t('steps.city.buildings')}
                    </p>
                  </div>
                  <div className="text-gray-400 dark:text-[var(--admin-text-subtle)]">
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
                    'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-colors',
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
                      {loc.roomPrices.length} {t('steps.building.rooms')}
                      {' · '}
                      {t('steps.building.from')} {formatPrice(Math.min(...loc.roomPrices.map((r) => r.discountedPrice || r.monthlyPrice)))} {t('currency')}
                    </p>
                  </div>
                  <div className="text-gray-400 dark:text-[var(--admin-text-subtle)]">
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
                      'w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors',
                      isSelected
                        ? 'border-coral bg-coral/5 dark:bg-coral/10'
                        : 'border-gray-200 dark:border-[var(--admin-border)] hover:border-coral/50 hover:bg-gray-50 dark:bg-[var(--admin-bg)]'
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center flex-shrink-0">
                      <RoomIcon size={18} className="text-navy dark:text-[var(--admin-text)]" />
                    </div>
                    <div className="text-start flex-1 min-w-0">
                      <p className="font-medium text-navy dark:text-[var(--admin-text)] text-sm">
                        {tRooms(`types.${room.type}`)}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">
                        <Bath size={12} />
                        <span className="truncate">{tRooms(`bathroom.${room.bathroomType}`)}</span>
                      </div>
                      {/* Apartment context — small reassurance that this tier
                          is offered across multiple apartments. Hidden when
                          the building hasn't been organized yet. */}
                      {room.apartmentCount > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-[var(--admin-text-subtle)] mt-0.5">
                          <Home size={10} />
                          <span className="truncate">
                            {t('roomCardApartmentContext', {
                              count: room.apartmentCount,
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-end flex-shrink-0">
                      <p className="font-bold text-coral text-sm">
                        {formatPrice(price)}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-[var(--admin-text-muted)]">
                        {tRooms('pricePerMonth')}
                      </p>
                      {room.discountedPrice && (
                        <p className="text-[10px] text-gray-400 dark:text-[var(--admin-text-subtle)] line-through">
                          {formatPrice(room.monthlyPrice)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : currentStep === 'personal' ? (
            /* Step 4: Personal Info */
            <div>
              <SummaryCard />
              <div className="space-y-3.5">
                {/* Name */}
                <div>
                  <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1 block">
                    {t('steps.personal.name')} *
                  </label>
                  <input
                    id="booking-name"
                    autoComplete="name"
                    {...register('name')}
                    placeholder={t('placeholders.fullName')}
                    className={inputClassName(!!errors.name)}
                  />
                </div>

                {/* Date of birth */}
                <div>
                  <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1 block">
                    {t('steps.personal.dateOfBirth')} *
                  </label>
                  <div className="relative">
                    <input
                      {...register('dateOfBirth')}
                      type="date"
                      lang="en"
                      max={maxDobStr}
                      className={cn(
                        inputClassName(!!errors.dateOfBirth),
                        !watchDateOfBirth && 'text-transparent'
                      )}
                    />
                    {!watchDateOfBirth && (
                      <span className="absolute inset-y-0 start-4 flex items-center pointer-events-none text-base sm:text-sm text-gray-400 dark:text-[var(--admin-text-subtle)]">
                        {isArabic ? 'يوم/شهر/سنة' : 'dd/mm/yyyy'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Occupation */}
                <div>
                  <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1.5 block">
                    {t('steps.personal.occupation')} *
                  </label>
                  <Controller
                    name="occupation"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-2">
                        {OCCUPATION_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => field.onChange(option)}
                            className={cn(
                              'px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                              watchOccupation === option
                                ? 'border-coral bg-coral/5 dark:bg-coral/10 text-coral'
                                : 'border-gray-200 dark:border-[var(--admin-border)] text-gray-600 dark:text-[var(--admin-text-muted)] hover:border-coral/50'
                            )}
                          >
                            {t(`steps.personal.occupationOptions.${option}`)}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                  {errors.occupation && (
                    <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.occupation.message}</p>
                  )}
                </div>
              </div>
            </div>
          ) : currentStep === 'contact' ? (
            /* Step 5: Contact Info */
            <div>
              <SummaryCard />
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1 block">
                    {t('steps.contact.email')} *
                  </label>
                  <input
                    id="booking-email"
                    autoComplete="email"
                    {...register('email')}
                    type="email"
                    placeholder={t('placeholders.email')}
                    className={inputClassName(!!errors.email)}
                  />
                </div>
                <div>
                  <PhoneInput
                    label={`${t('steps.contact.phone')} *`}
                    {...register('phone')}
                    placeholder={t('placeholders.phone')}
                    formatHint={t('phoneHint')}
                    error={errors.phone ? t('invalidPhone') : undefined}
                    className={inputClassName(!!errors.phone)}
                  />
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-[var(--admin-border)]">
                  <div>
                    <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1 block">
                      {t('steps.contact.emergencyContactName')} *
                    </label>
                    <input
                      {...register('emergencyContactName')}
                      placeholder={t('placeholders.emergencyName')}
                      className={inputClassName(!!errors.emergencyContactName)}
                    />
                  </div>
                </div>

                <div>
                  <PhoneInput
                    label={`${t('steps.contact.emergencyContactPhone')} *`}
                    {...register('emergencyContactPhone')}
                    placeholder={t('placeholders.emergencyPhone')}
                    formatHint={t('phoneHint')}
                    error={errors.emergencyContactPhone ? t('invalidPhone') : undefined}
                    className={inputClassName(!!errors.emergencyContactPhone)}
                  />
                </div>
              </div>
            </div>
          ) : currentStep === 'logistics' ? (
            /* Step 6: Logistics */
            <div>
              <SummaryCard />
              <div className="space-y-4">
                {/* Contract start date */}
                <div>
                  <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1 block">
                    {t('steps.logistics.contractStartDate')} *
                  </label>
                  <div className="relative">
                    <input
                      {...register('contractStartDate')}
                      type="date"
                      lang="en"
                      min={today}
                      className={cn(
                        inputClassName(!!errors.contractStartDate),
                        !watchContractStartDate && 'text-transparent'
                      )}
                    />
                    {!watchContractStartDate && (
                      <span className="absolute inset-y-0 start-4 flex items-center pointer-events-none text-base sm:text-sm text-gray-400 dark:text-[var(--admin-text-subtle)]">
                        {isArabic ? 'يوم/شهر/سنة' : 'dd/mm/yyyy'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Transportation */}
                <div>
                  <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1.5 block">
                    {t('steps.logistics.transportation')} *
                  </label>
                  <Controller
                    name="withTransportation"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => field.onChange(true)}
                          className={cn(
                            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors',
                            watchTransportation === true
                              ? 'border-coral bg-coral/5 dark:bg-coral/10'
                              : 'border-gray-200 dark:border-[var(--admin-border)] hover:border-coral/50'
                          )}
                        >
                          <Bus size={24} className={watchTransportation === true ? 'text-coral' : 'text-gray-400 dark:text-[var(--admin-text-subtle)]'} />
                          <span className={cn(
                            'text-sm font-medium',
                            watchTransportation === true ? 'text-coral' : 'text-gray-600 dark:text-[var(--admin-text-muted)]'
                          )}>
                            {t('steps.logistics.withTransportation')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange(false)}
                          className={cn(
                            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors',
                            watchTransportation === false
                              ? 'border-coral bg-coral/5 dark:bg-coral/10'
                              : 'border-gray-200 dark:border-[var(--admin-border)] hover:border-coral/50'
                          )}
                        >
                          <BusFront size={24} className={watchTransportation === false ? 'text-coral' : 'text-gray-400 dark:text-[var(--admin-text-subtle)]'} />
                          <span className={cn(
                            'text-sm font-medium',
                            watchTransportation === false ? 'text-coral' : 'text-gray-600 dark:text-[var(--admin-text-muted)]'
                          )}>
                            {t('steps.logistics.withoutTransportation')}
                          </span>
                        </button>
                      </div>
                    )}
                  />
                </div>
              </div>
            </div>
          ) : currentStep === 'additional' ? (
            /* Step 7: Additional Info */
            <div>
              <div className="space-y-4">
                {/* Medical issues */}
                <div>
                  <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1.5 block">
                    {t('steps.additional.medicalIssues')}
                  </label>
                  <Controller
                    name="hasMedicalIssues"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => field.onChange(false)}
                          className={cn(
                            'px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                            !watchHasMedicalIssues
                              ? 'border-coral bg-coral/5 dark:bg-coral/10 text-coral'
                              : 'border-gray-200 dark:border-[var(--admin-border)] text-gray-600 dark:text-[var(--admin-text-muted)] hover:border-coral/50'
                          )}
                        >
                          {t('steps.additional.no')}
                        </button>
                        <button
                          type="button"
                          onClick={() => field.onChange(true)}
                          className={cn(
                            'px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                            watchHasMedicalIssues
                              ? 'border-coral bg-coral/5 dark:bg-coral/10 text-coral'
                              : 'border-gray-200 dark:border-[var(--admin-border)] text-gray-600 dark:text-[var(--admin-text-muted)] hover:border-coral/50'
                          )}
                        >
                          {t('steps.additional.yes')}
                        </button>
                      </div>
                    )}
                  />
                  {watchHasMedicalIssues && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-1 block">
                        {t('steps.additional.medicalDescription')}
                      </label>
                      <textarea
                        {...register('medicalIssuesDescription')}
                        rows={3}
                        placeholder={t('placeholders.medicalDescription')}
                        className="w-full px-4 py-3 border border-gray-200 dark:border-[var(--admin-border)] rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral resize-none transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* How did you hear */}
                <div>
                  <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1 block">
                    {t('steps.additional.referralSource')} *
                  </label>
                  <select
                    {...register('referralSource')}
                    className={cn(
                      inputClassName(!!errors.referralSource),
                      'appearance-none bg-white dark:bg-[var(--admin-surface)]'
                    )}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      —
                    </option>
                    {REFERRAL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {t(`steps.additional.referralOptions.${option}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1 block">
                    {t('steps.additional.notes')}
                  </label>
                  <textarea
                    {...register('notes')}
                    rows={2}
                    placeholder={t('placeholders.notes')}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-[var(--admin-border)] rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral resize-none transition-colors"
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
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer - Next button on form steps, Submit on last step */}
        {isFormStep && submitStatus !== 'success' && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-[var(--admin-border)] flex-shrink-0">
            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
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
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-coral text-white font-semibold rounded-xl hover:bg-coral/90 transition-colors shadow-lg shadow-coral/25"
              >
                <span>{t('next')}</span>
                {isArabic ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            )}
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

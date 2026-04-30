'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Building2,
  DoorOpen,
  Calendar,
  Check,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatDate } from '@/lib/utils';

interface Props {
  residentId: string;
  residentName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'building' | 'room' | 'dates' | 'confirm';
const STEP_ORDER: Step[] = ['building', 'room', 'dates', 'confirm'];

interface BuildingListItem {
  id: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
  is_active: boolean;
  room_stats: {
    total: number;
    available: number;
    occupied: number;
    maintenance: number;
    reserved: number;
  };
}

interface BuildingsListResponse {
  data: BuildingListItem[];
  total: number;
}

interface BuildingRoomItem {
  id: string;
  room_number: string | null;
  floor: number | null;
  room_type: string;
  capacity: number;
  occupancy_mode: 'private' | 'shared';
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  active_assignments_count: number;
  apartment_id: string;
  apartment: { id: string; apartment_number: string; floor: number } | null;
}

interface BuildingDetailResponse {
  data: {
    id: string;
    city_en: string;
    city_ar: string;
    neighborhood_en: string;
    neighborhood_ar: string;
    rooms: BuildingRoomItem[];
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function roomVacant(r: BuildingRoomItem): boolean {
  if (r.status === 'maintenance' || r.status === 'reserved') return false;
  if (r.occupancy_mode === 'private') return r.active_assignments_count === 0;
  return r.active_assignments_count < r.capacity;
}

export default function MoveInWizard({
  residentId,
  residentName,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const t = useTranslations('admin.residents');
  const locale = useLocale();
  const isArabic = locale === 'ar';

  const [step, setStep] = useState<Step>('building');
  const [buildings, setBuildings] = useState<BuildingListItem[]>([]);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  const [roomsBuilding, setRoomsBuilding] = useState<
    BuildingDetailResponse['data'] | null
  >(null);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const [checkInDate, setCheckInDate] = useState(todayISO());
  const [checkOutDate, setCheckOutDate] = useState('');
  const [datesError, setDatesError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('building');
      setSelectedBuildingId(null);
      setRoomsBuilding(null);
      setSelectedRoomId(null);
      setCheckInDate(todayISO());
      setCheckOutDate('');
      setDatesError(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, submitting, onClose]);

  // Fetch buildings on enter step 'building'
  useEffect(() => {
    if (!isOpen || step !== 'building') return;
    if (buildings.length > 0) return;
    let cancelled = false;
    async function load() {
      setBuildingsLoading(true);
      try {
        const res = await fetch('/api/admin/buildings?limit=100&is_active=true');
        if (!res.ok) throw new Error('Failed');
        const json = (await res.json()) as BuildingsListResponse;
        if (!cancelled) setBuildings(json.data ?? []);
      } catch (err) {
        console.error('Move-in: buildings fetch failed:', err);
        if (!cancelled) toast.error(t('moveIn.toast.error'));
      } finally {
        if (!cancelled) setBuildingsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, step, buildings.length, t]);

  // Fetch rooms when entering 'room' step
  const loadRooms = useCallback(
    async (buildingId: string) => {
      setRoomsLoading(true);
      try {
        const res = await fetch(`/api/admin/buildings/${buildingId}`);
        if (!res.ok) throw new Error('Failed');
        const json = (await res.json()) as BuildingDetailResponse;
        setRoomsBuilding(json.data);
      } catch (err) {
        console.error('Move-in: rooms fetch failed:', err);
        toast.error(t('moveIn.toast.error'));
      } finally {
        setRoomsLoading(false);
      }
    },
    [t]
  );

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === selectedBuildingId) ?? null,
    [buildings, selectedBuildingId]
  );

  const selectedRoom = useMemo(() => {
    if (!roomsBuilding) return null;
    return roomsBuilding.rooms.find((r) => r.id === selectedRoomId) ?? null;
  }, [roomsBuilding, selectedRoomId]);

  function buildingLabel(b: BuildingListItem): string {
    return isArabic ? b.neighborhood_ar : b.neighborhood_en;
  }
  function buildingCity(b: BuildingListItem): string {
    return isArabic ? b.city_ar : b.city_en;
  }

  function roomFloorLabel(r: BuildingRoomItem | null | undefined): string | null {
    if (!r || r.floor == null) return null;
    return t('moveIn.roomCard.floorLabel', { floor: r.floor });
  }

  function roomVacancyLabel(r: BuildingRoomItem): string {
    if (r.status === 'maintenance') return t('moveIn.roomCard.maintenance');
    if (r.status === 'reserved') return t('moveIn.roomCard.reserved');
    if (!roomVacant(r)) return t('moveIn.roomCard.full');
    if (r.occupancy_mode === 'shared') {
      return t('moveIn.roomCard.bedsLabel', {
        occupied: r.active_assignments_count,
        capacity: r.capacity,
      });
    }
    return t('moveIn.roomCard.available');
  }

  function canAdvance(): boolean {
    switch (step) {
      case 'building':
        return !!selectedBuildingId;
      case 'room':
        return !!selectedRoom && roomVacant(selectedRoom);
      case 'dates':
        return DATE_RE.test(checkInDate) && !datesError;
      case 'confirm':
        return true;
    }
  }

  function validateDates(): boolean {
    setDatesError(null);
    if (!DATE_RE.test(checkInDate)) {
      setDatesError(t('moveIn.validation.checkInRequired'));
      return false;
    }
    if (checkOutDate) {
      if (!DATE_RE.test(checkOutDate)) {
        setDatesError(t('moveIn.validation.checkOutAfterCheckIn'));
        return false;
      }
      if (checkOutDate <= checkInDate) {
        setDatesError(t('moveIn.validation.checkOutAfterCheckIn'));
        return false;
      }
    }
    return true;
  }

  async function goNext() {
    if (step === 'building' && selectedBuildingId) {
      // Eagerly load rooms when transitioning to room step
      if (!roomsBuilding || roomsBuilding.id !== selectedBuildingId) {
        setSelectedRoomId(null);
        await loadRooms(selectedBuildingId);
      }
      setStep('room');
      return;
    }
    if (step === 'room') {
      setStep('dates');
      return;
    }
    if (step === 'dates') {
      if (!validateDates()) return;
      setStep('confirm');
      return;
    }
  }

  function goBack() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  }

  async function handleConfirm() {
    if (!selectedRoomId) return;
    if (!validateDates()) {
      setStep('dates');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/residents/${residentId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: selectedRoomId,
          check_in_date: checkInDate,
          check_out_date: checkOutDate || null,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        const code = json.error;
        const map: Record<string, string> = {
          roomFull: t('moveIn.toast.roomFull'),
          residentAlreadyAssigned: t('moveIn.toast.residentAlreadyAssigned'),
          roomUnavailable: t('moveIn.toast.roomUnavailable'),
          residentNotActive: t('moveIn.toast.residentNotActive'),
        };
        toast.error(code && map[code] ? map[code] : t('moveIn.toast.error'));
        return;
      }
      toast.success(t('moveIn.toast.success'));
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Move-in submit failed:', err);
      toast.error(t('moveIn.toast.error'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const stepIdx = STEP_ORDER.indexOf(step);
  const ChevronPrev = isArabic ? ChevronRight : ChevronLeft;
  const ChevronNext = isArabic ? ChevronLeft : ChevronRight;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl bg-white dark:bg-[var(--admin-surface)] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-[var(--admin-border)]">
          <div>
            <h2 className="text-lg font-semibold text-navy dark:text-[var(--admin-text)]">
              {t('moveIn.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">
              {t('moveIn.subtitle', { name: residentName })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-md text-gray-400 dark:text-[var(--admin-text-subtle)] hover:text-gray-600 dark:text-[var(--admin-text-muted)] hover:bg-gray-100 dark:bg-[var(--admin-surface-2)] disabled:opacity-50 transition-colors"
            aria-label={t('moveIn.actions.cancel')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-[var(--admin-border)] overflow-x-auto">
          {STEP_ORDER.map((s, i) => {
            const active = s === step;
            const done = i < stepIdx;
            return (
              <div key={s} className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    active && 'bg-coral text-white',
                    done && 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                    !active && !done && 'bg-gray-100 dark:bg-[var(--admin-surface-2)] text-gray-500 dark:text-[var(--admin-text-muted)]'
                  )}
                >
                  <span className="tabular-nums">{i + 1}</span>
                  <span>{t(`moveIn.steps.${s}`)}</span>
                  {done && <Check size={12} />}
                </div>
                {i < STEP_ORDER.length - 1 && (
                  <span className="text-gray-300 dark:text-[var(--admin-text-subtle)]">·</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'building' && (
            <BuildingStep
              loading={buildingsLoading}
              buildings={buildings}
              selectedId={selectedBuildingId}
              onSelect={setSelectedBuildingId}
              labelGetter={buildingLabel}
              cityGetter={buildingCity}
              emptyMsg={t('moveIn.empty.noBuildings')}
            />
          )}
          {step === 'room' && (
            <RoomStep
              loading={roomsLoading}
              rooms={roomsBuilding?.rooms ?? []}
              selectedId={selectedRoomId}
              onSelect={setSelectedRoomId}
              vacancyLabelGetter={roomVacancyLabel}
              floorLabelGetter={roomFloorLabel}
              emptyMsg={t('moveIn.empty.noRooms')}
            />
          )}
          {step === 'dates' && (
            <DatesStep
              checkIn={checkInDate}
              checkOut={checkOutDate}
              onCheckIn={(v) => {
                setCheckInDate(v);
                setDatesError(null);
              }}
              onCheckOut={(v) => {
                setCheckOutDate(v);
                setDatesError(null);
              }}
              error={datesError}
              isArabic={isArabic}
              t={t}
            />
          )}
          {step === 'confirm' && selectedBuilding && selectedRoom && (
            <ConfirmStep
              residentName={residentName}
              buildingNeighborhood={buildingLabel(selectedBuilding)}
              buildingCity={buildingCity(selectedBuilding)}
              room={selectedRoom}
              roomFloorLabel={roomFloorLabel(selectedRoom)}
              checkIn={checkInDate}
              checkOut={checkOutDate}
              isArabic={isArabic}
              t={t}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-100 dark:border-[var(--admin-border)] bg-gray-50 dark:bg-[var(--admin-bg)]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-[var(--admin-text-muted)] bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] rounded-lg hover:bg-gray-50 dark:bg-[var(--admin-bg)] disabled:opacity-50 transition-colors"
          >
            {t('moveIn.actions.cancel')}
          </button>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={goBack}
                disabled={submitting}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-[var(--admin-text-muted)] bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] rounded-lg hover:bg-gray-50 dark:bg-[var(--admin-bg)] disabled:opacity-50 transition-colors"
              >
                <ChevronPrev size={14} />
                {t('moveIn.actions.back')}
              </button>
            )}
            {step === 'confirm' ? (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-coral rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting
                  ? t('moveIn.actions.confirming')
                  : t('moveIn.actions.confirm')}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance()}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-navy rounded-lg hover:bg-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('moveIn.actions.next')}
                <ChevronNext size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Step subcomponents ---------- */

function BuildingStep({
  loading,
  buildings,
  selectedId,
  onSelect,
  labelGetter,
  cityGetter,
  emptyMsg,
}: {
  loading: boolean;
  buildings: BuildingListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  labelGetter: (b: BuildingListItem) => string;
  cityGetter: (b: BuildingListItem) => string;
  emptyMsg: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }
  if (buildings.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 dark:text-[var(--admin-text-subtle)]">
        <Building2 size={32} className="mx-auto mb-2 text-gray-300 dark:text-[var(--admin-text-subtle)]" />
        <p className="text-sm">{emptyMsg}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {buildings.map((b) => {
        const isSelected = selectedId === b.id;
        const availableBeds = b.room_stats.available;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelect(b.id)}
            className={cn(
              'text-start p-3 rounded-lg border-2 transition-colors',
              isSelected
                ? 'border-coral bg-coral/5 dark:bg-coral/10'
                : 'border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] hover:border-coral/50'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-navy dark:text-[var(--admin-text)] truncate">{labelGetter(b)}</p>
                <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">{cityGetter(b)}</p>
              </div>
              <Building2
                size={16}
                className={cn(
                  'flex-shrink-0',
                  isSelected ? 'text-coral' : 'text-gray-300 dark:text-[var(--admin-text-subtle)]'
                )}
              />
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
              {availableBeds} / {b.room_stats.total}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function RoomStep({
  loading,
  rooms,
  selectedId,
  onSelect,
  vacancyLabelGetter,
  floorLabelGetter,
  emptyMsg,
}: {
  loading: boolean;
  rooms: BuildingRoomItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  vacancyLabelGetter: (r: BuildingRoomItem) => string;
  floorLabelGetter: (r: BuildingRoomItem) => string | null;
  emptyMsg: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }
  if (rooms.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 dark:text-[var(--admin-text-subtle)]">
        <DoorOpen size={32} className="mx-auto mb-2 text-gray-300 dark:text-[var(--admin-text-subtle)]" />
        <p className="text-sm">{emptyMsg}</p>
      </div>
    );
  }
  // Sort: by apartment first (so rooms in the same apartment cluster), then
  // vacant first within an apartment, then by room_number.
  const sorted = [...rooms].sort((a, b) => {
    const aApt = a.apartment?.apartment_number ?? '';
    const bApt = b.apartment?.apartment_number ?? '';
    if (aApt !== bApt) return aApt.localeCompare(bApt);
    const av = roomVacant(a) ? 0 : 1;
    const bv = roomVacant(b) ? 0 : 1;
    if (av !== bv) return av - bv;
    return (a.room_number ?? '').localeCompare(b.room_number ?? '');
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {sorted.map((r) => {
        const vacant = roomVacant(r);
        const isSelected = selectedId === r.id;
        const floor = floorLabelGetter(r);
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => vacant && onSelect(r.id)}
            disabled={!vacant}
            className={cn(
              'text-start p-3 rounded-lg border-2 transition-colors',
              !vacant && 'border-gray-100 dark:border-[var(--admin-border)] bg-gray-50 dark:bg-[var(--admin-bg)] cursor-not-allowed opacity-60',
              vacant && !isSelected && 'border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] hover:border-coral/50',
              vacant && isSelected && 'border-coral bg-coral/5 dark:bg-coral/10'
            )}
          >
            <div className="flex items-center gap-1.5">
              <DoorOpen
                size={14}
                className={cn(
                  'flex-shrink-0',
                  vacant ? 'text-gray-400 dark:text-[var(--admin-text-subtle)]' : 'text-gray-300 dark:text-[var(--admin-text-subtle)]'
                )}
              />
              <p className="font-semibold text-navy dark:text-[var(--admin-text)] text-sm tabular-nums truncate">
                {r.room_number ?? '—'}
              </p>
            </div>
            {/* Apartment context — useful for supervisors who need to keep
                gender separation, friend grouping, etc. consistent within an
                apartment. Hidden when the apartment_number is the auto-default
                so it doesn't add noise for buildings that haven't been
                organized into real apartments yet. */}
            {r.apartment &&
              !/^F-?\d+-DEFAULT$/.test(r.apartment.apartment_number) && (
                <p className="text-[10px] text-gray-500 dark:text-[var(--admin-text-muted)] mt-1 truncate" dir="ltr">
                  {r.apartment.apartment_number}
                </p>
              )}
            {floor && (
              <p className="text-xs text-gray-400 dark:text-[var(--admin-text-subtle)] mt-1 tabular-nums">{floor}</p>
            )}
            <p
              className={cn(
                'text-xs mt-2 tabular-nums',
                vacant ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-[var(--admin-text-subtle)]'
              )}
            >
              {vacancyLabelGetter(r)}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-[var(--admin-text-subtle)] mt-0.5 uppercase tracking-wide">
              {r.room_type}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function DatesStep({
  checkIn,
  checkOut,
  onCheckIn,
  onCheckOut,
  error,
  isArabic,
  t,
}: {
  checkIn: string;
  checkOut: string;
  onCheckIn: (v: string) => void;
  onCheckOut: (v: string) => void;
  error: string | null;
  isArabic: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const placeholder = isArabic ? 'يوم/شهر/سنة' : 'DD/MM/YYYY';
  return (
    <div className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1.5">
          {t('moveIn.fields.checkIn')}
        </label>
        <div className="relative">
          <input
            type="date"
            lang="en"
            value={checkIn}
            onChange={(e) => onCheckIn(e.target.value)}
            className={cn(
              'block w-full rounded-lg border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] px-3 py-2 text-sm text-navy dark:text-[var(--admin-text)] shadow-sm focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral',
              !checkIn && 'text-transparent'
            )}
          />
          {!checkIn && (
            <span className="absolute inset-y-0 start-3 flex items-center pointer-events-none text-sm text-gray-400 dark:text-[var(--admin-text-subtle)]">
              {placeholder}
            </span>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-1.5">
          {t('moveIn.fields.checkOut')}
        </label>
        <div className="relative">
          <input
            type="date"
            lang="en"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(e) => onCheckOut(e.target.value)}
            className={cn(
              'block w-full rounded-lg border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] px-3 py-2 text-sm text-navy dark:text-[var(--admin-text)] shadow-sm focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral',
              !checkOut && 'text-transparent'
            )}
          />
          {!checkOut && (
            <span className="absolute inset-y-0 start-3 flex items-center pointer-events-none text-sm text-gray-400 dark:text-[var(--admin-text-subtle)]">
              {placeholder}
            </span>
          )}
        </div>
      </div>
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 text-sm">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

function ConfirmStep({
  residentName,
  buildingNeighborhood,
  buildingCity,
  room,
  roomFloorLabel,
  checkIn,
  checkOut,
  isArabic,
  t,
}: {
  residentName: string;
  buildingNeighborhood: string;
  buildingCity: string;
  room: BuildingRoomItem;
  roomFloorLabel: string | null;
  checkIn: string;
  checkOut: string;
  isArabic: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const dateLocale = isArabic ? 'ar' : 'en';
  return (
    <div className="space-y-3 max-w-xl">
      <Row icon={Building2} label={t('moveIn.fields.building')}>
        <span className="text-navy dark:text-[var(--admin-text)] font-medium">{buildingNeighborhood}</span>
        <span className="text-gray-400 dark:text-[var(--admin-text-subtle)] ms-2 text-xs">{buildingCity}</span>
      </Row>
      <Row icon={DoorOpen} label={t('moveIn.fields.room')}>
        <span className="text-navy dark:text-[var(--admin-text)] font-medium tabular-nums">
          {room.room_number ?? '—'}
        </span>
        {roomFloorLabel && (
          <span className="text-gray-400 dark:text-[var(--admin-text-subtle)] ms-2 text-xs">{roomFloorLabel}</span>
        )}
        {room.apartment &&
          !/^F-?\d+-DEFAULT$/.test(room.apartment.apartment_number) && (
            <span className="text-gray-400 dark:text-[var(--admin-text-subtle)] ms-2 text-xs" dir="ltr">
              · {room.apartment.apartment_number}
            </span>
          )}
      </Row>
      <Row icon={Calendar} label={t('moveIn.fields.checkIn')}>
        <span className="text-navy dark:text-[var(--admin-text)] tabular-nums">
          {formatDate(checkIn, dateLocale)}
        </span>
      </Row>
      <Row icon={Calendar} label={t('moveIn.fields.checkOut')}>
        <span className="text-navy dark:text-[var(--admin-text)] tabular-nums">
          {checkOut ? formatDate(checkOut, dateLocale) : '—'}
        </span>
      </Row>
      <div className="mt-4 px-3 py-2 rounded-lg bg-coral/5 dark:bg-coral/10 border border-coral/30 text-sm text-navy dark:text-[var(--admin-text)]">
        {t('moveIn.subtitle', { name: residentName })}
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-[var(--admin-bg)]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-[var(--admin-text-muted)] flex-shrink-0">
        <Icon size={12} />
        {label}
      </div>
      <div className="text-sm text-end">{children}</div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  Trash2,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';

const ROOM_TYPES = ['single', 'double', 'triple', 'suite'] as const;
const BATHROOM_TYPES = [
  'shared',
  'shared-a',
  'shared-b',
  'shared-balcony',
  'private',
  'private-balcony',
  'private-two-rooms',
  'master',
  'master-a',
  'master-b',
  'master-balcony',
  'suite',
] as const;
const ROOM_STATUSES = ['available', 'occupied', 'maintenance', 'reserved'] as const;
const OCCUPANCY_MODES = ['private', 'shared'] as const;

type RoomType = (typeof ROOM_TYPES)[number];
type BathroomType = (typeof BATHROOM_TYPES)[number];
type RoomStatus = (typeof ROOM_STATUSES)[number];
type OccupancyMode = (typeof OCCUPANCY_MODES)[number];

const MAX_NOTES = 5000;
const MAX_ROOM_NUMBER = 50;
const MIN_CAPACITY = 1;
const MAX_CAPACITY = 20;

// Mirrors migration 021's backfill mapping. Used to seed `capacity` when
// `room_type` changes and the user hasn't manually edited the value yet.
function defaultCapacityForType(rt: RoomType): number {
  switch (rt) {
    case 'single': return 1;
    case 'double': return 2;
    case 'triple': return 3;
    case 'suite':  return 2;
  }
}

export interface RoomFormValues {
  room_number: string;
  floor: string; // kept as string for the input; parsed on submit
  room_type: RoomType;
  bathroom_type: BathroomType;
  capacity: string; // string for input, parsed on submit
  occupancy_mode: OccupancyMode;
  monthly_price: string; // string for input, parsed on submit
  discounted_price: string;
  status: RoomStatus;
  notes: string;
}

interface RoomFormProps {
  mode: 'create' | 'edit';
  buildingId: string;
  buildingLabel?: string;
  roomId?: string;
  initial?: Partial<RoomFormValues>;
  canDelete?: boolean;
}

const EMPTY_VALUES: RoomFormValues = {
  room_number: '',
  floor: '',
  room_type: 'single',
  bathroom_type: 'shared',
  capacity: '1',
  occupancy_mode: 'private',
  monthly_price: '',
  discounted_price: '',
  status: 'available',
  notes: '',
};

export default function RoomForm({
  mode,
  buildingId,
  buildingLabel,
  roomId,
  initial,
  canDelete = false,
}: RoomFormProps) {
  const t = useTranslations('admin.buildings.roomForm');
  const tType = useTranslations('rooms.types');
  const tBath = useTranslations('rooms.bathroom');
  const tStatus = useTranslations('admin.buildings.roomStatus');
  const tMode = useTranslations('rooms.occupancyMode');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();

  const [values, setValues] = useState<RoomFormValues>({
    ...EMPTY_VALUES,
    ...initial,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  const roomTypeOptions = useMemo(
    () => ROOM_TYPES.map((v) => ({ value: v, label: tType(v) })),
    [tType]
  );
  const bathroomTypeOptions = useMemo(
    () => BATHROOM_TYPES.map((v) => ({ value: v, label: tBath(v) })),
    [tBath]
  );
  const statusOptions = useMemo(
    () => ROOM_STATUSES.map((v) => ({ value: v, label: tStatus(v) })),
    [tStatus]
  );
  const capacityNum = useMemo(() => {
    const n = parseInt(values.capacity, 10);
    return Number.isFinite(n) ? n : NaN;
  }, [values.capacity]);

  // A 1-bed room can't be "shared" — there's no second tenant to share with.
  // The select is disabled and force-locked to 'private' in that case.
  const sharedDisabled = capacityNum === 1;

  const occupancyModeOptions = useMemo(
    () => OCCUPANCY_MODES.map((v) => ({ value: v, label: tMode(v) })),
    [tMode]
  );

  function update<K extends keyof RoomFormValues>(
    key: K,
    value: RoomFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleRoomTypeChange(rt: RoomType) {
    setValues((v) => {
      const newDefault = defaultCapacityForType(rt);
      const currentDefault = defaultCapacityForType(v.room_type);
      const currentCapNum = parseInt(v.capacity, 10);
      // Only auto-update capacity if the user hadn't deviated from the
      // previous type's default — preserves manual overrides like a "suite"
      // bumped to 4.
      const capacity =
        Number.isFinite(currentCapNum) && currentCapNum === currentDefault
          ? String(newDefault)
          : v.capacity;
      const nextCapNum = parseInt(capacity, 10) || newDefault;
      const occupancy_mode: OccupancyMode =
        nextCapNum === 1 ? 'private' : v.occupancy_mode;
      return { ...v, room_type: rt, capacity, occupancy_mode };
    });
  }

  function handleCapacityChange(raw: string) {
    setValues((v) => {
      const n = parseInt(raw, 10);
      const occupancy_mode: OccupancyMode =
        Number.isFinite(n) && n === 1 ? 'private' : v.occupancy_mode;
      return { ...v, capacity: raw, occupancy_mode };
    });
  }

  // Live discount percentage when both prices are set and valid.
  const discountPercent = useMemo(() => {
    const m = parseFloat(values.monthly_price);
    const d = parseFloat(values.discounted_price);
    if (!Number.isFinite(m) || m <= 0) return null;
    if (!Number.isFinite(d) || d < 0 || d >= m) return null;
    return Math.round(((m - d) / m) * 100);
  }, [values.monthly_price, values.discounted_price]);

  const showStatusHelper =
    initial?.status !== values.status && values.status === 'occupied';

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    // monthly_price: required, positive number
    const m = parseFloat(values.monthly_price);
    if (!values.monthly_price.trim()) {
      errs.monthly_price = t('errors.priceRequired');
    } else if (!Number.isFinite(m) || m <= 0) {
      errs.monthly_price = t('errors.priceInvalid');
    }

    // discounted_price: optional; if set, non-negative and <= monthly
    if (values.discounted_price.trim()) {
      const d = parseFloat(values.discounted_price);
      if (!Number.isFinite(d) || d < 0) {
        errs.discounted_price = t('errors.discountInvalid');
      } else if (Number.isFinite(m) && m > 0 && d > m) {
        errs.discounted_price = t('errors.discountTooHigh');
      }
    }

    // floor: optional integer
    if (values.floor.trim()) {
      const f = parseFloat(values.floor);
      if (!Number.isFinite(f) || !Number.isInteger(f)) {
        errs.floor = t('errors.floorInvalid');
      }
    }

    // capacity: required integer in [MIN_CAPACITY, MAX_CAPACITY]
    const c = parseInt(values.capacity, 10);
    if (!values.capacity.trim()) {
      errs.capacity = t('errors.capacityRequired');
    } else if (
      !Number.isFinite(c) ||
      !Number.isInteger(c) ||
      c < MIN_CAPACITY ||
      c > MAX_CAPACITY
    ) {
      errs.capacity = t('errors.capacityInvalid');
    } else if (c === 1 && values.occupancy_mode === 'shared') {
      // Defensive: the change handlers should already prevent this, but
      // guard against external state mutations or stale form values.
      errs.occupancy_mode = t('errors.sharedRequiresMultipleBeds');
    }

    if (values.notes.length > MAX_NOTES) {
      errs.notes = t('errors.notesTooLong');
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(t('errors.fixBelow'));
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        room_type: values.room_type,
        bathroom_type: values.bathroom_type,
        capacity: Math.trunc(parseInt(values.capacity, 10)),
        occupancy_mode: values.occupancy_mode,
        status: values.status,
        monthly_price: parseFloat(values.monthly_price),
        room_number: values.room_number.trim()
          ? values.room_number.trim().slice(0, MAX_ROOM_NUMBER)
          : null,
        floor: values.floor.trim() ? Math.trunc(parseFloat(values.floor)) : null,
        discounted_price: values.discounted_price.trim()
          ? parseFloat(values.discounted_price)
          : null,
        notes: values.notes.trim() ? values.notes.trim().slice(0, MAX_NOTES) : null,
      };

      if (mode === 'create') {
        payload.building_id = buildingId;
      }

      const url =
        mode === 'create'
          ? '/api/admin/rooms'
          : `/api/admin/rooms/${roomId}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const code = json?.error;
        if (code === 'invalidPrice') {
          setErrors((e) => ({ ...e, monthly_price: t('errors.priceInvalid') }));
          toast.error(t('errors.priceInvalid'));
        } else if (code === 'discountExceedsPrice') {
          setErrors((e) => ({
            ...e,
            discounted_price: t('errors.discountTooHigh'),
          }));
          toast.error(t('errors.discountTooHigh'));
        } else if (code === 'invalidFloor') {
          setErrors((e) => ({ ...e, floor: t('errors.floorInvalid') }));
          toast.error(t('errors.floorInvalid'));
        } else if (code === 'invalidRoomType' || code === 'invalidBathroomType') {
          toast.error(t('errors.requiredMissing'));
        } else if (code === 'invalidStatus') {
          toast.error(t('errors.requiredMissing'));
        } else if (code === 'invalidCapacity') {
          setErrors((e) => ({ ...e, capacity: t('errors.capacityInvalid') }));
          toast.error(t('errors.capacityInvalid'));
        } else if (code === 'invalidOccupancyMode') {
          toast.error(t('errors.requiredMissing'));
        } else if (code === 'sharedRequiresMultipleBeds') {
          setErrors((e) => ({
            ...e,
            occupancy_mode: t('errors.sharedRequiresMultipleBeds'),
          }));
          toast.error(t('errors.sharedRequiresMultipleBeds'));
        } else if (code === 'buildingNotFound' || code === 'invalidBuildingId') {
          toast.error(t('errors.buildingNotFound'));
        } else {
          toast.error(t('toast.genericError'));
        }
        return;
      }

      toast.success(mode === 'create' ? t('toast.created') : t('toast.updated'));
      router.push(`/${locale}/admin/buildings/${buildingId}`);
      router.refresh();
    } catch (err) {
      console.error('Room form submit failed:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!roomId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const code = json?.error;
        if (code === 'roomHasAssignments') {
          toast.error(t('errors.roomHasAssignments'));
        } else {
          toast.error(t('toast.genericError'));
        }
        setConfirmDelete(false);
        return;
      }
      toast.success(t('toast.deleted'));
      router.push(`/${locale}/admin/buildings/${buildingId}`);
      router.refresh();
    } catch (err) {
      console.error('Room delete failed:', err);
      toast.error(t('toast.genericError'));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const heading = mode === 'create' ? t('createTitle') : t('editTitle');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header strip */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-navy transition-colors w-fit"
        >
          <BackIcon size={16} />
          {t('cancel')}
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {mode === 'edit' && canDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting || deleting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <Trash2 size={14} />
              {t('delete')}
            </button>
          )}
          <button
            type="button"
            onClick={() => router.back()}
            disabled={submitting || deleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting || deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {mode === 'create' ? t('create') : t('save')}
          </button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-navy">{heading}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {mode === 'edit' ? t('editSubtitle') : t('createSubtitle')}
        </p>
        {buildingLabel && (
          <p className="text-xs text-gray-500 mt-1">
            <span className="text-gray-400">{t('buildingLabel')}: </span>
            <span className="text-navy font-medium">{buildingLabel}</span>
          </p>
        )}
      </div>

      {/* Section: Basics */}
      <Section title={t('sections.basics')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('fields.roomNumber')}
            value={values.room_number}
            onChange={(e) => update('room_number', e.target.value)}
            placeholder="101"
            dir="ltr"
            lang="en"
            inputMode="text"
            maxLength={MAX_ROOM_NUMBER}
            helperText={t('helpers.roomNumber')}
          />
          <Input
            label={t('fields.floor')}
            type="number"
            value={values.floor}
            onChange={(e) => update('floor', e.target.value)}
            placeholder="0"
            dir="ltr"
            lang="en"
            inputMode="numeric"
            step={1}
            error={errors.floor}
            helperText={t('helpers.floor')}
          />
          <Select
            label={t('fields.roomType')}
            value={values.room_type}
            onChange={(e) => handleRoomTypeChange(e.target.value as RoomType)}
            options={roomTypeOptions}
          />
          <Select
            label={t('fields.bathroomType')}
            value={values.bathroom_type}
            onChange={(e) =>
              update('bathroom_type', e.target.value as BathroomType)
            }
            options={bathroomTypeOptions}
          />
          <Input
            label={t('fields.capacity')}
            type="number"
            value={values.capacity}
            onChange={(e) => handleCapacityChange(e.target.value)}
            placeholder="1"
            dir="ltr"
            lang="en"
            inputMode="numeric"
            step={1}
            min={MIN_CAPACITY}
            max={MAX_CAPACITY}
            error={errors.capacity}
            helperText={errors.capacity ? undefined : t('helpers.capacity')}
          />
          <div>
            <Select
              label={t('fields.occupancyMode')}
              value={values.occupancy_mode}
              onChange={(e) =>
                update('occupancy_mode', e.target.value as OccupancyMode)
              }
              options={
                sharedDisabled
                  ? occupancyModeOptions.filter((o) => o.value === 'private')
                  : occupancyModeOptions
              }
              error={errors.occupancy_mode}
              disabled={sharedDisabled}
            />
            {!errors.occupancy_mode && (
              <p className="mt-1.5 text-xs text-gray-500">
                {sharedDisabled
                  ? t('helpers.occupancyModeSingle')
                  : t('helpers.occupancyMode')}
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* Section: Pricing */}
      <Section title={t('sections.pricing')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('fields.monthlyPrice')}
            type="number"
            value={values.monthly_price}
            onChange={(e) => update('monthly_price', e.target.value)}
            placeholder="2500"
            dir="ltr"
            lang="en"
            inputMode="decimal"
            step="0.01"
            min={0}
            error={errors.monthly_price}
          />
          <div>
            <Input
              label={t('fields.discountedPrice')}
              type="number"
              value={values.discounted_price}
              onChange={(e) => update('discounted_price', e.target.value)}
              placeholder=""
              dir="ltr"
              lang="en"
              inputMode="decimal"
              step="0.01"
              min={0}
              error={errors.discounted_price}
              helperText={
                errors.discounted_price ? undefined : t('helpers.discountedPrice')
              }
            />
            {discountPercent !== null && !errors.discounted_price && (
              <p className="mt-1.5 text-sm text-coral font-medium">
                {t('discount.percentOff', { pct: discountPercent })}
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* Section: Status & notes */}
      <Section title={t('sections.status')}>
        <div className="space-y-4">
          <Select
            label={t('fields.status')}
            value={values.status}
            onChange={(e) => update('status', e.target.value as RoomStatus)}
            options={statusOptions}
          />
          {showStatusHelper && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <span>{t('helpers.statusOccupied')}</span>
            </div>
          )}
          <Textarea
            label={t('fields.notes')}
            value={values.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={4}
            maxLength={MAX_NOTES}
            error={errors.notes}
            helperText={errors.notes ? undefined : t('helpers.notes')}
          />
        </div>
      </Section>

      {/* Footer save (mirrors top) */}
      <div className="flex items-center justify-end gap-2 pt-2 flex-wrap">
        {mode === 'edit' && canDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={submitting || deleting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors me-auto"
          >
            <Trash2 size={14} />
            {t('delete')}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.back()}
          disabled={submitting || deleting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting || deleting}
          className="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors shadow-sm"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {mode === 'create' ? t('create') : t('save')}
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => (deleting ? null : setConfirmDelete(false))}
        onConfirm={handleDelete}
        title={t('deleteConfirm.title')}
        description={t('deleteConfirm.description')}
        confirmLabel={deleting ? t('deleting') : t('deleteConfirm.confirm')}
        cancelLabel={t('deleteConfirm.cancel')}
        variant="danger"
        loading={deleting}
      />
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-navy mb-4">{title}</h2>
      {children}
    </section>
  );
}

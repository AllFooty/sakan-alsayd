'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';

const MAX_APT_NUMBER = 50;
const MAX_DESC = 5000;
const MAX_NOTES = 5000;
const MIN_FLOOR = -10;
const MAX_FLOOR = 200;
const MIN_BATHROOMS = 0;
const MAX_BATHROOMS = 20;

export interface ApartmentFormValues {
  apartment_number: string;
  floor: string; // string for the input; parsed on submit
  description_en: string;
  description_ar: string;
  has_kitchen: boolean;
  has_living_room: boolean;
  shared_bathroom_count: string;
  private_bathroom_count: string;
  sort_order: string;
  is_active: boolean;
  notes: string;
}

interface ApartmentFormProps {
  mode: 'create' | 'edit';
  buildingId: string;
  buildingLabel?: string;
  apartmentId?: string;
  initial?: Partial<ApartmentFormValues>;
  canDelete?: boolean;
  canToggleActive?: boolean;
}

const EMPTY_VALUES: ApartmentFormValues = {
  apartment_number: '',
  floor: '0',
  description_en: '',
  description_ar: '',
  has_kitchen: true,
  has_living_room: false,
  shared_bathroom_count: '1',
  private_bathroom_count: '0',
  sort_order: '0',
  is_active: true,
  notes: '',
};

export default function ApartmentForm({
  mode,
  buildingId,
  buildingLabel,
  apartmentId,
  initial,
  canDelete = false,
  canToggleActive = false,
}: ApartmentFormProps) {
  const t = useTranslations('admin.buildings.apartmentForm');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();

  const [values, setValues] = useState<ApartmentFormValues>({
    ...EMPTY_VALUES,
    ...initial,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  function update<K extends keyof ApartmentFormValues>(
    key: K,
    value: ApartmentFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    if (!values.apartment_number.trim()) {
      errs.apartment_number = t('errors.apartmentNumberRequired');
    }

    const f = parseFloat(values.floor);
    if (
      !values.floor.trim() ||
      !Number.isFinite(f) ||
      !Number.isInteger(f) ||
      f < MIN_FLOOR ||
      f > MAX_FLOOR
    ) {
      errs.floor = t('errors.floorInvalid');
    }

    for (const k of ['shared_bathroom_count', 'private_bathroom_count'] as const) {
      const v = parseInt(values[k], 10);
      if (
        !values[k].trim() ||
        !Number.isFinite(v) ||
        !Number.isInteger(v) ||
        v < MIN_BATHROOMS ||
        v > MAX_BATHROOMS
      ) {
        errs[k] = t('errors.bathroomCountInvalid');
      }
    }

    const so = parseInt(values.sort_order, 10);
    if (!values.sort_order.trim() || !Number.isFinite(so) || !Number.isInteger(so)) {
      errs.sort_order = t('errors.sortOrderInvalid');
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
        apartment_number: values.apartment_number.trim().slice(0, MAX_APT_NUMBER),
        floor: Math.trunc(parseFloat(values.floor)),
        description_en: values.description_en.trim().slice(0, MAX_DESC),
        description_ar: values.description_ar.trim().slice(0, MAX_DESC),
        has_kitchen: values.has_kitchen,
        has_living_room: values.has_living_room,
        shared_bathroom_count: parseInt(values.shared_bathroom_count, 10),
        private_bathroom_count: parseInt(values.private_bathroom_count, 10),
        sort_order: parseInt(values.sort_order, 10),
        notes: values.notes.trim() ? values.notes.trim().slice(0, MAX_NOTES) : null,
      };
      if (canToggleActive) {
        payload.is_active = values.is_active;
      }

      const url =
        mode === 'create'
          ? `/api/admin/buildings/${buildingId}/apartments`
          : `/api/admin/apartments/${apartmentId}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const code = json?.error;
        if (code === 'apartmentNumberRequired') {
          setErrors((e) => ({
            ...e,
            apartment_number: t('errors.apartmentNumberRequired'),
          }));
          toast.error(t('errors.apartmentNumberRequired'));
        } else if (code === 'apartmentNumberTaken') {
          setErrors((e) => ({
            ...e,
            apartment_number: t('errors.apartmentNumberTaken'),
          }));
          toast.error(t('errors.apartmentNumberTaken'));
        } else if (code === 'invalidFloor') {
          setErrors((e) => ({ ...e, floor: t('errors.floorInvalid') }));
          toast.error(t('errors.floorInvalid'));
        } else if (code === 'invalidBathroomCount') {
          toast.error(t('errors.bathroomCountInvalid'));
        } else if (code === 'invalidSortOrder') {
          setErrors((e) => ({ ...e, sort_order: t('errors.sortOrderInvalid') }));
          toast.error(t('errors.sortOrderInvalid'));
        } else if (code === 'buildingInactive') {
          toast.error(t('errors.buildingInactive'));
        } else if (code === 'buildingNotFound') {
          toast.error(t('errors.buildingNotFound'));
        } else if (code === 'noChanges') {
          toast.error(t('errors.noChanges'));
        } else {
          toast.error(t('toast.genericError'));
        }
        return;
      }

      toast.success(mode === 'create' ? t('toast.created') : t('toast.updated'));
      router.push(`/${locale}/admin/buildings/${buildingId}#layout`);
      router.refresh();
    } catch (err) {
      console.error('Apartment form submit failed:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!apartmentId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/apartments/${apartmentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const code = json?.error;
        if (code === 'apartmentHasRooms') {
          toast.error(t('errors.apartmentHasRooms'));
        } else {
          toast.error(t('toast.genericError'));
        }
        setConfirmDelete(false);
        return;
      }
      toast.success(t('toast.deleted'));
      router.push(`/${locale}/admin/buildings/${buildingId}#layout`);
      router.refresh();
    } catch (err) {
      console.error('Apartment delete failed:', err);
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
          className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-[var(--admin-text-muted)] hover:text-navy dark:text-[var(--admin-text)] transition-colors w-fit"
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
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-[var(--admin-surface)] border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              <Trash2 size={14} />
              {t('delete')}
            </button>
          )}
          <button
            type="button"
            onClick={() => router.back()}
            disabled={submitting || deleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[var(--admin-text-muted)] bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] rounded-lg hover:bg-gray-50 dark:bg-[var(--admin-bg)] disabled:opacity-50 transition-colors"
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
        <h1 className="text-2xl font-bold text-navy dark:text-[var(--admin-text)]">{heading}</h1>
        <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">
          {mode === 'edit' ? t('editSubtitle') : t('createSubtitle')}
        </p>
        {buildingLabel && (
          <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-1">
            <span className="text-gray-400 dark:text-[var(--admin-text-subtle)]">{t('buildingLabel')}: </span>
            <span className="text-navy dark:text-[var(--admin-text)] font-medium">{buildingLabel}</span>
          </p>
        )}
      </div>

      {/* Section: Basics */}
      <Section title={t('sections.basics')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('fields.apartmentNumber')}
            value={values.apartment_number}
            onChange={(e) => update('apartment_number', e.target.value)}
            placeholder="A1"
            dir="ltr"
            lang="en"
            inputMode="text"
            maxLength={MAX_APT_NUMBER}
            error={errors.apartment_number}
            helperText={errors.apartment_number ? undefined : t('helpers.apartmentNumber')}
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
            min={MIN_FLOOR}
            max={MAX_FLOOR}
            error={errors.floor}
            helperText={errors.floor ? undefined : t('helpers.floor')}
          />
          <Input
            label={t('fields.descriptionEn')}
            value={values.description_en}
            onChange={(e) => update('description_en', e.target.value)}
            dir="ltr"
            lang="en"
            maxLength={MAX_DESC}
          />
          <Input
            label={t('fields.descriptionAr')}
            value={values.description_ar}
            onChange={(e) => update('description_ar', e.target.value)}
            dir="rtl"
            lang="ar"
            maxLength={MAX_DESC}
          />
        </div>
      </Section>

      {/* Section: Layout & shared facilities */}
      <Section title={t('sections.layout')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CheckboxRow
            label={t('fields.hasKitchen')}
            helper={t('helpers.hasKitchen')}
            checked={values.has_kitchen}
            onChange={(v) => update('has_kitchen', v)}
          />
          <CheckboxRow
            label={t('fields.hasLivingRoom')}
            helper={t('helpers.hasLivingRoom')}
            checked={values.has_living_room}
            onChange={(v) => update('has_living_room', v)}
          />
          <Input
            label={t('fields.sharedBathroomCount')}
            type="number"
            value={values.shared_bathroom_count}
            onChange={(e) => update('shared_bathroom_count', e.target.value)}
            dir="ltr"
            lang="en"
            inputMode="numeric"
            step={1}
            min={MIN_BATHROOMS}
            max={MAX_BATHROOMS}
            error={errors.shared_bathroom_count}
            helperText={
              errors.shared_bathroom_count
                ? undefined
                : t('helpers.sharedBathroomCount')
            }
          />
          <Input
            label={t('fields.privateBathroomCount')}
            type="number"
            value={values.private_bathroom_count}
            onChange={(e) => update('private_bathroom_count', e.target.value)}
            dir="ltr"
            lang="en"
            inputMode="numeric"
            step={1}
            min={MIN_BATHROOMS}
            max={MAX_BATHROOMS}
            error={errors.private_bathroom_count}
            helperText={
              errors.private_bathroom_count
                ? undefined
                : t('helpers.privateBathroomCount')
            }
          />
          <Input
            label={t('fields.sortOrder')}
            type="number"
            value={values.sort_order}
            onChange={(e) => update('sort_order', e.target.value)}
            dir="ltr"
            lang="en"
            inputMode="numeric"
            step={1}
            error={errors.sort_order}
            helperText={errors.sort_order ? undefined : t('helpers.sortOrder')}
          />
        </div>
      </Section>

      {/* Section: Status & notes */}
      <Section title={t('sections.status')}>
        <div className="space-y-4">
          {canToggleActive && (
            <CheckboxRow
              label={t('fields.isActive')}
              checked={values.is_active}
              onChange={(v) => update('is_active', v)}
            />
          )}
          <Textarea
            label={t('fields.notes')}
            value={values.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={4}
            maxLength={MAX_NOTES}
            helperText={t('helpers.notes')}
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
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-[var(--admin-surface)] border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:bg-red-500/10 disabled:opacity-50 transition-colors me-auto"
          >
            <Trash2 size={14} />
            {t('delete')}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.back()}
          disabled={submitting || deleting}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[var(--admin-text-muted)] bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] rounded-lg hover:bg-gray-50 dark:bg-[var(--admin-bg)] disabled:opacity-50 transition-colors"
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
    <section className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
      <h2 className="text-sm font-semibold text-navy dark:text-[var(--admin-text)] mb-4">{title}</h2>
      {children}
    </section>
  );
}

function CheckboxRow({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] hover:bg-gray-50 dark:bg-[var(--admin-bg)] transition-colors">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-[var(--admin-border)] text-coral focus:ring-coral/30"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-navy dark:text-[var(--admin-text)]">{label}</span>
        {helper && <span className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">{helper}</span>}
      </span>
    </label>
  );
}

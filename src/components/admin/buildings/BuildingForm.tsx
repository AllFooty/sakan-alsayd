'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  Plus,
  Trash2,
  DoorOpen,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import FieldError from '@/components/admin/shared/FieldError';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const URL_RE = /^https?:\/\/.+/i;

export interface LandmarkInput {
  name_en: string;
  name_ar: string;
  distance_en: string;
  distance_ar: string;
}

export interface BuildingFormValues {
  slug: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
  description_en: string;
  description_ar: string;
  map_url: string;
  landmarks: LandmarkInput[];
  is_active: boolean;
  is_placeholder: boolean;
  sort_order: number;
  operational_since: string;
}

interface BuildingFormProps {
  mode: 'create' | 'edit';
  buildingId?: string;
  initial?: Partial<BuildingFormValues>;
  canToggleStatus?: boolean;
  // Whether the current user can edit operational_since. Only super_admin
  // and deputy_general_manager can — for everyone else the field renders
  // read-only or hidden so they can't backdate buildings.
  canEditOperationalSince?: boolean;
  // When true, all inputs are disabled and the save buttons are hidden.
  // Used on the edit page when the building is soft-deleted (every PATCH
  // would 409 anyway), so users see the data without triggering errors.
  readOnly?: boolean;
}

const EMPTY_LANDMARK: LandmarkInput = {
  name_en: '',
  name_ar: '',
  distance_en: '',
  distance_ar: '',
};

const EMPTY_VALUES: BuildingFormValues = {
  slug: '',
  city_en: '',
  city_ar: '',
  neighborhood_en: '',
  neighborhood_ar: '',
  description_en: '',
  description_ar: '',
  map_url: '',
  landmarks: [],
  is_active: true,
  is_placeholder: false,
  sort_order: 0,
  operational_since: '',
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export default function BuildingForm({
  mode,
  buildingId,
  initial,
  canToggleStatus = false,
  canEditOperationalSince = false,
  readOnly = false,
}: BuildingFormProps) {
  const t = useTranslations('admin.buildings.form');
  const tToast = useTranslations('admin.buildings.toast');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();

  const [values, setValues] = useState<BuildingFormValues>({
    ...EMPTY_VALUES,
    ...initial,
    landmarks: initial?.landmarks ?? [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');

  // Auto-derive slug from neighborhood + city in create mode until the user
  // types into the slug field directly. In edit mode, never auto-derive.
  useEffect(() => {
    if (mode !== 'create' || slugTouched) return;
    const candidate = slugify(
      `${values.city_en || ''} ${values.neighborhood_en || ''}`.trim()
    );
    setValues((v) => (v.slug === candidate ? v : { ...v, slug: candidate }));
  }, [mode, slugTouched, values.city_en, values.neighborhood_en]);

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  function update<K extends keyof BuildingFormValues>(
    key: K,
    value: BuildingFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!values.slug.trim()) errs.slug = t('errors.slugRequired');
    else if (!SLUG_RE.test(values.slug)) errs.slug = t('errors.slugInvalid');
    if (!values.city_en.trim()) errs.city_en = t('errors.required');
    if (!values.city_ar.trim()) errs.city_ar = t('errors.required');
    if (!values.neighborhood_en.trim())
      errs.neighborhood_en = t('errors.required');
    if (!values.neighborhood_ar.trim())
      errs.neighborhood_ar = t('errors.required');
    if (values.map_url.trim() && !URL_RE.test(values.map_url.trim())) {
      errs.map_url = t('errors.urlInvalid');
    }
    if (!Number.isFinite(values.sort_order)) {
      errs.sort_order = t('errors.numberInvalid');
    }
    values.landmarks.forEach((lm, i) => {
      const hasAny =
        lm.name_en.trim() ||
        lm.name_ar.trim() ||
        lm.distance_en.trim() ||
        lm.distance_ar.trim();
      if (!hasAny) return;
      if (!lm.name_en.trim() || !lm.name_ar.trim()) {
        errs[`landmark-${i}`] = t('errors.landmarkBilingual');
      }
    });
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(t('errors.fixBelow'));
      return;
    }

    setSubmitting(true);
    try {
      const cleanedLandmarks = values.landmarks
        .map((lm) => ({
          name_en: lm.name_en.trim(),
          name_ar: lm.name_ar.trim(),
          distance_en: lm.distance_en.trim() || undefined,
          distance_ar: lm.distance_ar.trim() || undefined,
        }))
        .filter((lm) => lm.name_en && lm.name_ar);

      const payload: Record<string, unknown> = {
        slug: values.slug.trim(),
        city_en: values.city_en.trim(),
        city_ar: values.city_ar.trim(),
        neighborhood_en: values.neighborhood_en.trim(),
        neighborhood_ar: values.neighborhood_ar.trim(),
        description_en: values.description_en.trim(),
        description_ar: values.description_ar.trim(),
        map_url: values.map_url.trim() || null,
        landmarks: cleanedLandmarks,
        sort_order: values.sort_order,
      };
      if (canToggleStatus) {
        payload.is_active = values.is_active;
        payload.is_placeholder = values.is_placeholder;
      }
      // Only super_admin / deputy_general_manager can rewrite when the
      // building came online. Skip the field for everyone else (the API
      // would 403 anyway).
      if (canEditOperationalSince && values.operational_since) {
        payload.operational_since = values.operational_since;
      }

      const url =
        mode === 'create'
          ? '/api/admin/buildings'
          : `/api/admin/buildings/${buildingId}`;
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const code = json?.error;
        if (code === 'slugTaken') {
          setErrors((e) => ({ ...e, slug: t('errors.slugTaken') }));
          toast.error(t('errors.slugTaken'));
        } else if (code === 'invalidSlug') {
          setErrors((e) => ({ ...e, slug: t('errors.slugInvalid') }));
          toast.error(t('errors.slugInvalid'));
        } else if (code === 'invalidMapUrl') {
          setErrors((e) => ({ ...e, map_url: t('errors.urlInvalid') }));
          toast.error(t('errors.urlInvalid'));
        } else if (code === 'requiredFieldsMissing') {
          const revalidated = validate();
          if (Object.keys(revalidated).length > 0) {
            setErrors(revalidated);
          } else {
            const fallback: Record<string, string> = {
              slug: t('errors.required'),
              city_en: t('errors.required'),
              city_ar: t('errors.required'),
              neighborhood_en: t('errors.required'),
              neighborhood_ar: t('errors.required'),
              map_url: t('errors.required'),
            };
            setErrors(fallback);
          }
          toast.error(t('errors.requiredMissing'));
        } else {
          toast.error(tToast('genericError'));
        }
        return;
      }

      const json = await res.json();
      toast.success(mode === 'create' ? t('toast.created') : t('toast.updated'));
      const targetId = mode === 'create' ? json.id : buildingId;
      router.push(`/${locale}/admin/buildings/${targetId}`);
      router.refresh();
    } catch (err) {
      console.error('Building form submit failed:', err);
      toast.error(tToast('genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  function addLandmark() {
    setValues((v) => ({ ...v, landmarks: [...v.landmarks, { ...EMPTY_LANDMARK }] }));
  }
  function removeLandmark(i: number) {
    setValues((v) => ({
      ...v,
      landmarks: v.landmarks.filter((_, idx) => idx !== i),
    }));
  }
  function updateLandmark<K extends keyof LandmarkInput>(
    i: number,
    key: K,
    value: LandmarkInput[K]
  ) {
    setValues((v) => ({
      ...v,
      landmarks: v.landmarks.map((lm, idx) =>
        idx === i ? { ...lm, [key]: value } : lm
      ),
    }));
  }

  const heading = useMemo(
    () => (mode === 'create' ? t('createTitle') : t('editTitle')),
    [mode, t]
  );

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
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[var(--admin-text-muted)] bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] rounded-lg hover:bg-gray-50 dark:bg-[var(--admin-bg)] disabled:opacity-50 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {mode === 'create' ? t('create') : t('save')}
            </button>
          </div>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold text-navy dark:text-[var(--admin-text)]">{heading}</h1>
        <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">
          {mode === 'edit' ? t('editSubtitle') : t('createSubtitle')}
        </p>
      </div>

      {mode === 'edit' && buildingId && (
        <div className="flex flex-col gap-2 rounded-xl border border-coral/20 bg-coral/5 dark:bg-coral/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-coral/10 text-coral flex items-center justify-center flex-shrink-0">
              <DoorOpen size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy dark:text-[var(--admin-text)]">
                {t('manageRoomsTitle')}
              </p>
              <p className="text-xs text-gray-600 dark:text-[var(--admin-text-muted)] mt-0.5">
                {t('manageRoomsDescription')}
              </p>
            </div>
          </div>
          <Link
            href={`/${locale}/admin/buildings/${buildingId}#layout`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-[var(--admin-surface)] border border-coral/30 text-coral text-sm font-medium rounded-lg hover:bg-coral/10 transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <DoorOpen size={14} />
            {t('manageRoomsCta')}
          </Link>
        </div>
      )}

      <fieldset disabled={readOnly} className="space-y-4 m-0 p-0 border-0 disabled:opacity-70">
      {/* Section: Identifiers + display */}
      <Section title={t('sections.basics')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('fields.slug')}
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              update('slug', e.target.value);
            }}
            placeholder="khobar-alolaya"
            dir="ltr"
            error={errors.slug}
            helperText={t('helpers.slug')}
          />
          <Input
            label={t('fields.sortOrder')}
            type="number"
            value={String(values.sort_order)}
            onChange={(e) => update('sort_order', parseInt(e.target.value || '0', 10))}
            error={errors.sort_order}
          />
        </div>
        {canEditOperationalSince && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Input
              label={t('fields.operationalSince')}
              type="date"
              lang="en"
              max={new Date().toISOString().slice(0, 10)}
              value={values.operational_since}
              onChange={(e) => update('operational_since', e.target.value)}
              error={errors.operational_since}
              helperText={t('helpers.operationalSince')}
            />
          </div>
        )}
        {canToggleStatus && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <ToggleField
              label={t('fields.isActive')}
              description={t('helpers.isActive')}
              checked={values.is_active}
              onChange={(v) => update('is_active', v)}
            />
            <ToggleField
              label={t('fields.isPlaceholder')}
              description={t('helpers.isPlaceholder')}
              checked={values.is_placeholder}
              onChange={(v) => update('is_placeholder', v)}
            />
          </div>
        )}
      </Section>

      {/* Section: Bilingual names */}
      <Section title={t('sections.names')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('fields.cityEn')}
            value={values.city_en}
            onChange={(e) => update('city_en', e.target.value)}
            dir="ltr"
            error={errors.city_en}
          />
          <Input
            label={t('fields.cityAr')}
            value={values.city_ar}
            onChange={(e) => update('city_ar', e.target.value)}
            dir="rtl"
            error={errors.city_ar}
          />
          <Input
            label={t('fields.neighborhoodEn')}
            value={values.neighborhood_en}
            onChange={(e) => update('neighborhood_en', e.target.value)}
            dir="ltr"
            error={errors.neighborhood_en}
          />
          <Input
            label={t('fields.neighborhoodAr')}
            value={values.neighborhood_ar}
            onChange={(e) => update('neighborhood_ar', e.target.value)}
            dir="rtl"
            error={errors.neighborhood_ar}
          />
        </div>
      </Section>

      {/* Section: Descriptions */}
      <Section title={t('sections.description')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Textarea
            label={t('fields.descriptionEn')}
            value={values.description_en}
            onChange={(e) => update('description_en', e.target.value)}
            dir="ltr"
            rows={5}
          />
          <Textarea
            label={t('fields.descriptionAr')}
            value={values.description_ar}
            onChange={(e) => update('description_ar', e.target.value)}
            dir="rtl"
            rows={5}
          />
        </div>
      </Section>

      {/* Section: Map */}
      <Section title={t('sections.location')}>
        <Input
          label={t('fields.mapUrl')}
          value={values.map_url}
          onChange={(e) => update('map_url', e.target.value)}
          placeholder="https://maps.app.goo.gl/..."
          dir="ltr"
          error={errors.map_url}
          helperText={t('helpers.mapUrl')}
        />
      </Section>

      {/* Section: Landmarks editor */}
      <Section
        title={t('sections.landmarks')}
        action={
          <button
            type="button"
            onClick={addLandmark}
            className="flex items-center gap-1 text-sm text-coral hover:text-coral/80 font-medium"
          >
            <Plus size={14} />
            {t('addLandmark')}
          </button>
        }
      >
        {values.landmarks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-[var(--admin-text-subtle)] italic">{t('noLandmarks')}</p>
        ) : (
          <ul className="space-y-3">
            {values.landmarks.map((lm, i) => (
              <li
                key={i}
                className="border border-gray-200 dark:border-[var(--admin-border)] rounded-xl p-4 space-y-3 bg-gray-50/50 dark:bg-[var(--admin-surface-2)]/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-[var(--admin-text-muted)]">
                    {t('landmarkN', { n: i + 1 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLandmark(i)}
                    className="p-1 text-gray-400 dark:text-[var(--admin-text-subtle)] hover:text-red-600 dark:text-red-400 transition-colors"
                    aria-label={t('removeLandmark')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={t('fields.landmarkNameEn')}
                    value={lm.name_en}
                    onChange={(e) => updateLandmark(i, 'name_en', e.target.value)}
                    dir="ltr"
                  />
                  <Input
                    label={t('fields.landmarkNameAr')}
                    value={lm.name_ar}
                    onChange={(e) => updateLandmark(i, 'name_ar', e.target.value)}
                    dir="rtl"
                  />
                  <Input
                    label={t('fields.landmarkDistanceEn')}
                    value={lm.distance_en}
                    onChange={(e) => updateLandmark(i, 'distance_en', e.target.value)}
                    dir="ltr"
                  />
                  <Input
                    label={t('fields.landmarkDistanceAr')}
                    value={lm.distance_ar}
                    onChange={(e) => updateLandmark(i, 'distance_ar', e.target.value)}
                    dir="rtl"
                  />
                </div>
                <FieldError
                  id={`landmark-${i}-error`}
                  message={errors[`landmark-${i}`]}
                  withIcon
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
      </fieldset>

      {/* Footer save (mirrors the top, useful on long pages) */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[var(--admin-text-muted)] bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] rounded-lg hover:bg-gray-50 dark:bg-[var(--admin-bg)] disabled:opacity-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {mode === 'create' ? t('create') : t('save')}
          </button>
        </div>
      )}
    </form>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-navy dark:text-[var(--admin-text)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 dark:border-[var(--admin-border)] p-3 hover:border-coral/50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-[var(--admin-border)] text-coral focus:ring-coral"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium text-navy dark:text-[var(--admin-text)]">{label}</span>
        <span className="block text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">{description}</span>
      </span>
    </label>
  );
}

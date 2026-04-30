'use client';

import { useMemo, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  FileText,
  Loader2,
  Save,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import type { ResidentRow, ResidentStatus } from '@/lib/residents/types';

interface Props {
  mode: 'create' | 'edit';
  /** Existing resident when mode === 'edit' */
  resident?: ResidentRow;
  /** Pre-fill form values when mode === 'create' (e.g. from a booking) */
  prefill?: Partial<{
    full_name: string;
    phone: string;
    email: string;
    national_id_or_iqama: string;
    nationality: string;
    date_of_birth: string;
    university_or_workplace: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
  }>;
  /** When set, the resident POST will link back to this booking and the
   *  user is redirected into the move-in wizard after save. */
  fromBookingId?: string;
}

type Translator = ReturnType<typeof useTranslations<'admin.residents'>>;

function makeSchema(t: Translator) {
  return z.object({
    full_name: z
      .string()
      .trim()
      .min(1, t('form.validation.nameRequired'))
      .max(200),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{6,30}$/, t('form.validation.phoneInvalid')),
    email: z
      .string()
      .trim()
      .email(t('form.validation.emailInvalid'))
      .max(254)
      .optional()
      .or(z.literal('')),
    national_id_or_iqama: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal('')),
    nationality: z.string().trim().max(500).optional().or(z.literal('')),
    date_of_birth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, t('form.validation.dobInvalid'))
      .optional()
      .or(z.literal('')),
    university_or_workplace: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal('')),
    emergency_contact_name: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal('')),
    emergency_contact_phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{6,30}$/, t('form.validation.phoneInvalid'))
      .optional()
      .or(z.literal('')),
    profile_image: z
      .string()
      .trim()
      .url(t('form.validation.urlInvalid'))
      .max(1000)
      .optional()
      .or(z.literal('')),
    status: z.enum(['active', 'checked_out', 'suspended']).optional(),
    notes: z.string().max(5000).optional().or(z.literal('')),
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

const STATUS_OPTIONS: ResidentStatus[] = [
  'active',
  'checked_out',
  'suspended',
];

function emptyToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export default function ResidentForm({
  mode,
  resident,
  prefill,
  fromBookingId,
}: Props) {
  const t = useTranslations('admin.residents');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();

  const schema = useMemo(() => makeSchema(t), [t]);

  const defaultValues: FormValues = useMemo(
    () => ({
      full_name: resident?.full_name ?? prefill?.full_name ?? '',
      phone: resident?.phone ?? prefill?.phone ?? '',
      email: resident?.email ?? prefill?.email ?? '',
      national_id_or_iqama:
        resident?.national_id_or_iqama ?? prefill?.national_id_or_iqama ?? '',
      nationality: resident?.nationality ?? prefill?.nationality ?? '',
      date_of_birth: resident?.date_of_birth ?? prefill?.date_of_birth ?? '',
      university_or_workplace:
        resident?.university_or_workplace ??
        prefill?.university_or_workplace ??
        '',
      emergency_contact_name:
        resident?.emergency_contact_name ?? prefill?.emergency_contact_name ?? '',
      emergency_contact_phone:
        resident?.emergency_contact_phone ??
        prefill?.emergency_contact_phone ??
        '',
      profile_image: resident?.profile_image ?? '',
      status: resident?.status ?? 'active',
      notes: resident?.notes ?? '',
    }),
    [resident, prefill]
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const [submitting, setSubmitting] = useState(false);
  const watchDob = watch('date_of_birth');

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  const cancelHref =
    mode === 'edit' && resident
      ? `/${locale}/admin/residents/${resident.id}`
      : `/${locale}/admin/residents`;

  function errorMessage(code: unknown): string {
    switch (code) {
      case 'requiredFieldsMissing':
        return t('form.toast.requiredFields');
      case 'invalidPhone':
        return t('form.validation.phoneInvalid');
      case 'invalidEmail':
        return t('form.validation.emailInvalid');
      case 'invalidDateOfBirth':
        return t('form.validation.dobInvalid');
      case 'invalidProfileImage':
        return t('form.validation.urlInvalid');
      case 'invalidStatus':
        return t('form.validation.statusInvalid');
      case 'noChanges':
        return t('form.toast.noChanges');
      default:
        return t('toast.genericError');
    }
  }

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        email: emptyToNull(values.email),
        national_id_or_iqama: emptyToNull(values.national_id_or_iqama),
        nationality: emptyToNull(values.nationality),
        date_of_birth: emptyToNull(values.date_of_birth),
        university_or_workplace: emptyToNull(values.university_or_workplace),
        emergency_contact_name: emptyToNull(values.emergency_contact_name),
        emergency_contact_phone: emptyToNull(values.emergency_contact_phone),
        profile_image: emptyToNull(values.profile_image),
        notes: emptyToNull(values.notes),
      };

      if (mode === 'edit' && values.status) {
        payload.status = values.status;
      }

      if (mode === 'create' && fromBookingId) {
        payload.from_booking_id = fromBookingId;
      }

      const url =
        mode === 'create'
          ? '/api/admin/residents'
          : `/api/admin/residents/${resident?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(errorMessage(json?.error));
        return;
      }

      const json = (await res.json().catch(() => ({}))) as { id?: string };
      const targetId = mode === 'create' ? json.id : resident?.id;
      toast.success(
        mode === 'create'
          ? t('form.toast.createSuccess')
          : t('form.toast.updateSuccess')
      );
      if (targetId) {
        const suffix = mode === 'create' && fromBookingId ? '?move_in=1' : '';
        router.push(`/${locale}/admin/residents/${targetId}${suffix}`);
        router.refresh();
      }
    } catch (err) {
      console.error('Resident form submit failed:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const heading =
    mode === 'create' ? t('form.title.create') : t('form.title.edit');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Header strip */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-[var(--admin-text-muted)] hover:text-navy dark:text-[var(--admin-text)] transition-colors w-fit"
        >
          <BackIcon size={16} />
          {t('form.actions.cancel')}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(cancelHref)}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[var(--admin-text-muted)] bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] rounded-lg hover:bg-gray-50 dark:bg-[var(--admin-bg)] disabled:opacity-50 transition-colors"
          >
            {t('form.actions.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {submitting
              ? t('form.actions.saving')
              : t('form.actions.save')}
          </button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-navy dark:text-[var(--admin-text)]">{heading}</h1>
      </div>

      {/* Section: Personal info */}
      <Section title={t('form.sections.personal')} icon={<User size={16} />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('form.fields.full_name')}
            {...register('full_name')}
            error={errors.full_name?.message}
          />
          <Input
            label={t('form.fields.phone')}
            {...register('phone')}
            dir="ltr"
            placeholder={t('form.placeholders.phone')}
            className="tabular-nums"
            error={errors.phone?.message}
          />
          <Input
            label={t('form.fields.email')}
            type="email"
            {...register('email')}
            dir="ltr"
            placeholder={t('form.placeholders.email')}
            error={errors.email?.message}
          />
          <Input
            label={t('form.fields.national_id_or_iqama')}
            {...register('national_id_or_iqama')}
            dir="ltr"
            placeholder={t('form.placeholders.national_id_or_iqama')}
            className="tabular-nums"
            error={errors.national_id_or_iqama?.message}
          />
          <Input
            label={t('form.fields.nationality')}
            {...register('nationality')}
            error={errors.nationality?.message}
          />
          {/* Date of birth — overlay pattern (see project memory) */}
          <div className="w-full">
            <label className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-2">
              {t('form.fields.date_of_birth')}
            </label>
            <div className="relative">
              <input
                type="date"
                lang="en"
                {...register('date_of_birth')}
                className={cn(
                  'block w-full rounded-lg border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] px-3 py-2 text-sm text-navy dark:text-[var(--admin-text)] shadow-sm transition-colors focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral disabled:cursor-not-allowed disabled:opacity-50',
                  errors.date_of_birth && 'border-red-500 focus:border-red-500 focus:ring-red-500',
                  !watchDob && 'text-transparent'
                )}
              />
              {!watchDob && (
                <span className="absolute inset-y-0 start-3 flex items-center pointer-events-none text-sm text-gray-400 dark:text-[var(--admin-text-subtle)]">
                  {isArabic ? 'يوم/شهر/سنة' : 'DD/MM/YYYY'}
                </span>
              )}
            </div>
            {errors.date_of_birth?.message && (
              <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">
                {errors.date_of_birth.message}
              </p>
            )}
          </div>
          <Input
            label={t('form.fields.university_or_workplace')}
            {...register('university_or_workplace')}
            error={errors.university_or_workplace?.message}
          />
          <Input
            label={t('form.fields.profile_image')}
            {...register('profile_image')}
            dir="ltr"
            placeholder={t('form.placeholders.profile_image')}
            error={errors.profile_image?.message}
          />
        </div>
      </Section>

      {/* Section: Emergency contact */}
      <Section
        title={t('form.sections.emergency')}
        icon={<AlertCircle size={16} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('form.fields.emergency_contact_name')}
            {...register('emergency_contact_name')}
            error={errors.emergency_contact_name?.message}
          />
          <Input
            label={t('form.fields.emergency_contact_phone')}
            {...register('emergency_contact_phone')}
            dir="ltr"
            placeholder={t('form.placeholders.phone')}
            className="tabular-nums"
            error={errors.emergency_contact_phone?.message}
          />
        </div>
      </Section>

      {/* Section: Status & notes */}
      <Section
        title={t('form.sections.statusNotes')}
        icon={<FileText size={16} />}
      >
        <div className="space-y-4">
          {mode === 'edit' && (
            <div className="w-full max-w-xs">
              <label className="block text-sm font-medium text-navy dark:text-[var(--admin-text)] mb-2">
                {t('form.fields.status')}
              </label>
              <select
                {...register('status')}
                className={cn(
                  'block w-full rounded-lg border border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] px-3 py-2 text-sm text-navy dark:text-[var(--admin-text)] shadow-sm transition-colors focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral',
                  errors.status &&
                    'border-red-500 focus:border-red-500 focus:ring-red-500'
                )}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
              {errors.status?.message && (
                <p className="mt-1.5 text-sm text-red-500 dark:text-red-400">
                  {errors.status.message}
                </p>
              )}
            </div>
          )}
          <Textarea
            label={t('form.fields.notes')}
            {...register('notes')}
            rows={5}
            placeholder={t('form.placeholders.notes')}
            error={errors.notes?.message}
          />
        </div>
      </Section>

      {/* Footer save */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[var(--admin-text-muted)] bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] rounded-lg hover:bg-gray-50 dark:bg-[var(--admin-bg)] disabled:opacity-50 transition-colors"
        >
          {t('form.actions.cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors shadow-sm"
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {submitting ? t('form.actions.saving') : t('form.actions.save')}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-coral">{icon}</span>}
        <h2 className="text-sm font-semibold text-navy dark:text-[var(--admin-text)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

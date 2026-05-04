'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Users as UsersIcon,
  UserX,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  Building2,
  DoorOpen,
  Calendar,
  ExternalLink,
  IdCard,
  Briefcase,
  Globe,
  AlertCircle,
  Wrench,
  Pencil,
  Archive,
  LogIn,
  LogOut,
  Home as HomeIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '@/components/admin/shared/StatusBadge';
import {
  getMaintenanceStatusVariant,
  getMaintenancePriorityVariant,
} from '@/components/admin/shared/StatusBadge';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';
import MoveInWizard from '@/components/admin/residents/MoveInWizard';
import CheckOutDialog from '@/components/admin/residents/CheckOutDialog';
import ResidentDocumentsManager from '@/components/admin/residents/ResidentDocumentsManager';
import { useAuth } from '@/lib/auth/hooks';
import { cn, formatDate } from '@/lib/utils';
import { isAutoApartmentNumber } from '@/lib/apartments/auto-name';
import { showUndoToast } from '@/lib/admin/undoToast';
import type {
  ResidentDetailPayload,
  ResidentStatus,
  ResidentAssignmentHistoryItem,
  ResidentMaintenanceItem,
} from '@/lib/residents/types';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface ApartmentMate {
  id: string;
  room_id: string;
  resident_id: string;
  rooms: { room_number: string | null } | null;
  resident: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    profile_image: string | null;
    status: string;
  } | null;
}

function residentStatusVariant(status: ResidentStatus): BadgeVariant {
  switch (status) {
    case 'active':
      return 'success';
    case 'checked_out':
      return 'neutral';
    case 'suspended':
      return 'warning';
    default:
      return 'default';
  }
}

interface Props {
  id: string;
}

export default function ResidentDetail({ id }: Props) {
  const t = useTranslations('admin.residents');
  const tUndo = useTranslations('admin.undo');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const canEdit =
    !!profile &&
    (profile.role === 'super_admin' ||
      profile.role === 'deputy_general_manager' ||
      profile.role === 'branch_manager' ||
      profile.role === 'supervision_staff');

  const [resident, setResident] = useState<ResidentDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [moveInOpen, setMoveInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [apartmentMates, setApartmentMates] = useState<ApartmentMate[]>([]);

  async function handleArchive() {
    setArchiving(true);
    const priorStatus = resident?.status;
    try {
      const res = await fetch(`/api/admin/residents/${id}`, {
        method: 'DELETE',
      });
      if (res.status === 409) {
        toast.error(t('form.toast.deleteConflict'));
        setArchiveOpen(false);
        return;
      }
      if (!res.ok) throw new Error('Failed');
      router.push(`/${locale}/admin/residents`);
      // Show undo toast after navigation. Sonner is mounted in AdminShell
      // so the toast persists across the route change.
      if (priorStatus && priorStatus !== 'checked_out') {
        showUndoToast({
          message: tUndo('residentArchived'),
          undoLabel: tUndo('label'),
          restoredMessage: tUndo('restored'),
          failedMessage: tUndo('failed'),
          onUndo: async () => {
            const r = await fetch(`/api/admin/residents/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: priorStatus }),
            });
            if (!r.ok) return false;
            router.push(`/${locale}/admin/residents/${id}`);
            return true;
          },
        });
      } else {
        toast.success(t('form.toast.deleteSuccess'));
      }
    } catch (err) {
      console.error('Failed to archive resident:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setArchiving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchResident() {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/admin/residents/${id}`);
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Failed');
        const json = (await res.json()) as { data: ResidentDetailPayload };
        setResident(json.data);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch resident:', err);
        toast.error(t('toast.genericError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchResident();
    return () => {
      cancelled = true;
    };
  }, [id, t, refreshKey]);

  // After landing here from a booking conversion, auto-open the move-in
  // wizard. We strip the ?move_in=1 query param immediately so the modal
  // does not re-open on every refresh / refetch.
  useEffect(() => {
    if (!resident) return;
    if (searchParams.get('move_in') !== '1') return;
    if (resident.status !== 'active') return;
    if (resident.current_assignment) return;
    setMoveInOpen(true);
    router.replace(`/${locale}/admin/residents/${id}`);
  }, [resident, searchParams, router, locale, id]);

  // Fetch apartment-mates whenever the resident's current assignment
  // resolves to an apartment. Filtered to active assignments by the API,
  // and we strip out the resident themselves on the client.
  useEffect(() => {
    const aptId = resident?.current_assignment?.apartment_id ?? null;
    if (!aptId) {
      setApartmentMates([]);
      return;
    }
    let cancelled = false;
    async function loadMates(apartmentId: string) {
      try {
        const res = await fetch(`/api/admin/apartments/${apartmentId}/residents`);
        if (cancelled) return;
        if (!res.ok) return;
        const json = (await res.json()) as { data: ApartmentMate[] };
        const mates = (json.data ?? []).filter(
          (m) => m.resident && m.resident.id !== id
        );
        setApartmentMates(mates);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch apartment-mates:', err);
        }
      }
    }
    loadMates(aptId);
    return () => {
      cancelled = true;
    };
  }, [resident?.current_assignment?.apartment_id, id, refreshKey]);

  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  if (loading) return <DetailSkeleton />;

  if (notFound || !resident) {
    return (
      <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-12 text-center">
        <UserX size={40} className="mx-auto text-gray-300 dark:text-[var(--admin-text-subtle)]" />
        <h2 className="mt-4 text-lg font-semibold text-navy dark:text-[var(--admin-text)]">
          {t('toast.notFound')}
        </h2>
        <Link
          href={`/${locale}/admin/residents`}
          className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy/90 transition-colors"
        >
          <BackIcon size={16} />
          {t('detail.backToList')}
        </Link>
      </div>
    );
  }

  const current = resident.current_assignment;
  const currentNeighborhood = current
    ? isArabic
      ? current.building_neighborhood_ar
      : current.building_neighborhood_en
    : null;
  const currentCity = current
    ? isArabic
      ? current.building_city_ar
      : current.building_city_en
    : null;

  const subline = (() => {
    const parts: string[] = [];
    if (resident.nationality) parts.push(resident.nationality);
    if (current && currentNeighborhood) {
      const room = current.room_number
        ? t('card.roomLabel', { number: current.room_number })
        : null;
      parts.push(room ? `${currentNeighborhood} · ${room}` : currentNeighborhood);
    }
    return parts.length > 0 ? parts.join(' — ') : '—';
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            href={`/${locale}/admin/residents`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-[var(--admin-text-muted)] hover:text-navy dark:text-[var(--admin-text)] transition-colors w-fit"
          >
            <BackIcon size={16} />
            {t('detail.backToList')}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-navy dark:text-[var(--admin-text)]">{resident.full_name}</h1>
            <StatusBadge
              label={t(`status.${resident.status}`)}
              variant={residentStatusVariant(resident.status)}
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">{subline}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {resident.status === 'active' && !current && (
              <button
                type="button"
                onClick={() => setMoveInOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
              >
                <LogIn size={14} />
                {t('detail.moveInButton')}
              </button>
            )}
            {current && (
              <button
                type="button"
                onClick={() => setCheckOutOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[var(--admin-surface)] border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 text-sm font-medium rounded-lg hover:bg-amber-50 dark:bg-amber-500/10 transition-colors"
              >
                <LogOut size={14} />
                {t('detail.checkOutButton')}
              </button>
            )}
            <Link
              href={`/${locale}/admin/residents/${id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] text-navy dark:text-[var(--admin-text)] text-sm font-medium rounded-lg hover:border-coral hover:text-coral transition-colors"
            >
              <Pencil size={14} />
              {t('detail.editButton')}
            </Link>
            {resident.status !== 'checked_out' && (
              <button
                type="button"
                onClick={() => setArchiveOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[var(--admin-surface)] border border-gray-200 dark:border-[var(--admin-border)] text-gray-600 dark:text-[var(--admin-text-muted)] text-sm font-medium rounded-lg hover:border-amber-400 dark:hover:border-amber-500/50 hover:text-amber-600 dark:text-amber-400 transition-colors"
              >
                <Archive size={14} />
                {t('detail.archiveButton')}
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
        title={t('detail.archiveConfirm.title')}
        description={t('detail.archiveConfirm.description', { name: resident.full_name })}
        confirmLabel={t('detail.archiveConfirm.confirm')}
        cancelLabel={t('detail.archiveConfirm.cancel')}
        variant="warning"
        loading={archiving}
      />

      <MoveInWizard
        residentId={id}
        residentName={resident.full_name}
        isOpen={moveInOpen}
        onClose={() => setMoveInOpen(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />

      {current && (
        <CheckOutDialog
          assignmentId={current.id}
          residentName={resident.full_name}
          checkInDate={current.check_in_date}
          buildingNeighborhoodLabel={
            isArabic
              ? current.building_neighborhood_ar
              : current.building_neighborhood_en
          }
          roomLabel={
            current.room_number
              ? t('card.roomLabel', { number: current.room_number })
              : null
          }
          isOpen={checkOutOpen}
          onClose={() => setCheckOutOpen(false)}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-4">
          {/* Profile */}
          <Section title={t('detail.profile')}>
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="flex-shrink-0">
                {resident.profile_image ? (
                  // Plain <img> — profile image URLs aren't host-allowlisted for
                  // next/image, so use a regular tag to avoid a config touch.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resident.profile_image}
                    alt={resident.full_name}
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded-full object-cover bg-gray-100 dark:bg-[var(--admin-surface-2)] border border-gray-200 dark:border-[var(--admin-border)]"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-gray-100 dark:bg-[var(--admin-surface-2)] border border-gray-200 dark:border-[var(--admin-border)] flex items-center justify-center text-gray-400 dark:text-[var(--admin-text-subtle)]">
                    <UsersIcon size={36} />
                  </div>
                )}
              </div>
              <dl className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <DefRow label={t('detail.phoneLabel')} icon={Phone}>
                  {resident.phone ? (
                    <span dir="ltr" className="tabular-nums text-gray-700 dark:text-[var(--admin-text-muted)]">
                      {resident.phone}
                    </span>
                  ) : (
                    <NotProvided label={t('detail.notProvided')} />
                  )}
                </DefRow>
                <DefRow label={t('detail.emailLabel')} icon={Mail}>
                  {resident.email ? (
                    <span className="text-gray-700 dark:text-[var(--admin-text-muted)] break-all">{resident.email}</span>
                  ) : (
                    <NotProvided label={t('detail.notProvided')} />
                  )}
                </DefRow>
                <DefRow label={t('detail.nationalityLabel')} icon={Globe}>
                  {resident.nationality ? (
                    <span className="text-gray-700 dark:text-[var(--admin-text-muted)]">{resident.nationality}</span>
                  ) : (
                    <NotProvided label={t('detail.notProvided')} />
                  )}
                </DefRow>
                <DefRow
                  label={t('detail.universityWorkplaceLabel')}
                  icon={Briefcase}
                >
                  {resident.university_or_workplace ? (
                    <span className="text-gray-700 dark:text-[var(--admin-text-muted)]">
                      {resident.university_or_workplace}
                    </span>
                  ) : (
                    <NotProvided label={t('detail.notProvided')} />
                  )}
                </DefRow>
                <DefRow
                  label={t('detail.nationalIdLabel')}
                  icon={IdCard}
                  className="sm:col-span-2"
                >
                  {resident.national_id_or_iqama ? (
                    <span dir="ltr" className="tabular-nums text-gray-700 dark:text-[var(--admin-text-muted)]">
                      {resident.national_id_or_iqama}
                    </span>
                  ) : (
                    <NotProvided label={t('detail.notProvided')} />
                  )}
                </DefRow>
              </dl>
            </div>
          </Section>

          {/* Emergency contact */}
          <Section title={t('detail.emergencyContact')} icon={AlertCircle}>
            {resident.emergency_contact_name || resident.emergency_contact_phone ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <DefRow label={t('detail.emergencyNameLabel')}>
                  {resident.emergency_contact_name ? (
                    <span className="text-gray-700 dark:text-[var(--admin-text-muted)]">
                      {resident.emergency_contact_name}
                    </span>
                  ) : (
                    <NotProvided label={t('detail.notProvided')} />
                  )}
                </DefRow>
                <DefRow label={t('detail.emergencyPhoneLabel')} icon={Phone}>
                  {resident.emergency_contact_phone ? (
                    <a
                      href={`tel:${resident.emergency_contact_phone}`}
                      dir="ltr"
                      className="tabular-nums text-coral hover:text-coral/80 font-medium"
                    >
                      {resident.emergency_contact_phone}
                    </a>
                  ) : (
                    <NotProvided label={t('detail.notProvided')} />
                  )}
                </DefRow>
              </dl>
            ) : (
              <p className="text-sm text-gray-400 dark:text-[var(--admin-text-subtle)] italic">
                {t('detail.notProvided')}
              </p>
            )}
          </Section>

          {/* Notes */}
          <Section title={t('detail.notes')}>
            {resident.notes ? (
              <p className="text-sm text-gray-700 dark:text-[var(--admin-text-muted)] leading-relaxed whitespace-pre-wrap">
                {resident.notes}
              </p>
            ) : (
              <p className="text-sm text-gray-400 dark:text-[var(--admin-text-subtle)] italic">{t('detail.noNotes')}</p>
            )}
          </Section>

          {/* Assignment history */}
          <Section title={t('detail.assignmentHistory')} icon={Calendar}>
            {resident.assignment_history.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-[var(--admin-text-subtle)] italic">
                {t('detail.noAssignmentHistory')}
              </p>
            ) : (
              <ol className="space-y-3">
                {resident.assignment_history.map((item) => (
                  <AssignmentHistoryItem
                    key={item.id}
                    item={item}
                    isArabic={isArabic}
                    locale={locale}
                    t={t}
                  />
                ))}
              </ol>
            )}
          </Section>

          {/* Maintenance history */}
          <Section title={t('detail.maintenanceHistory')} icon={Wrench}>
            {resident.maintenance_history.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-[var(--admin-text-subtle)] italic">
                {t('detail.noMaintenance')}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-[var(--admin-border)]">
                {resident.maintenance_history.map((m) => (
                  <MaintenanceHistoryItem
                    key={m.id}
                    item={m}
                    locale={locale}
                    isArabic={isArabic}
                  />
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          {/* Current assignment */}
          <Section title={t('detail.currentAssignment')} icon={Building2}>
            {current ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-base font-semibold text-navy dark:text-[var(--admin-text)]">
                    {currentNeighborhood}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">{currentCity}</p>
                </div>
                <dl className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-[var(--admin-border)]">
                  <SidebarRow
                    icon={DoorOpen}
                    label={t('detail.roomLabel')}
                  >
                    <span className="text-gray-700 dark:text-[var(--admin-text-muted)] tabular-nums">
                      {current.room_number ?? '—'}
                      {current.floor !== null && (
                        <span className="text-gray-400 dark:text-[var(--admin-text-subtle)] ms-2 text-xs">
                          {t('card.floorLabel', { floor: current.floor })}
                        </span>
                      )}
                    </span>
                  </SidebarRow>
                  {current.apartment_number && !isAutoApartmentNumber(current.apartment_number) && (
                    <SidebarRow icon={HomeIcon} label={t('detail.apartmentLabel')}>
                      <span dir="ltr" className="text-gray-700 dark:text-[var(--admin-text-muted)] tabular-nums">
                        {current.apartment_number}
                      </span>
                    </SidebarRow>
                  )}
                  <SidebarRow icon={Calendar} label={t('detail.checkInLabel')}>
                    <span className="text-gray-700 dark:text-[var(--admin-text-muted)]">
                      {formatDate(current.check_in_date, isArabic ? 'ar' : 'en')}
                    </span>
                  </SidebarRow>
                  <SidebarRow icon={Calendar} label={t('detail.checkOutLabel')}>
                    <span className="text-gray-700 dark:text-[var(--admin-text-muted)]">
                      {current.check_out_date
                        ? formatDate(
                            current.check_out_date,
                            isArabic ? 'ar' : 'en'
                          )
                        : '—'}
                    </span>
                  </SidebarRow>
                </dl>
                <Link
                  href={`/${locale}/admin/buildings/${current.building_id}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-coral hover:text-coral/80 font-medium"
                >
                  <ExternalLink size={12} />
                  {t('detail.buildingLabel')}
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center py-3 text-gray-400 dark:text-[var(--admin-text-subtle)]">
                <UsersIcon size={28} className="mb-2" />
                <p className="text-sm italic">{t('detail.noAssignment')}</p>
              </div>
            )}
          </Section>

          {/* Apartment-mates — visible only when the resident is in an apartment
              that we know about. Filtered to active residents excluding self. */}
          {current?.apartment_id && (
            <Section title={t('detail.apartmentMates')} icon={HomeIcon}>
              {apartmentMates.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-[var(--admin-text-subtle)] italic">
                  {t('detail.noApartmentMates')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {apartmentMates.map((m) => (
                    <ApartmentMateRow
                      key={m.id}
                      mate={m}
                      locale={locale}
                      t={t}
                    />
                  ))}
                </ul>
              )}
              {current.apartment_number && !isAutoApartmentNumber(current.apartment_number) && (
                <p className="mt-3 pt-3 border-t border-gray-100 dark:border-[var(--admin-border)] text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">
                  {t('detail.apartmentMatesContext', {
                    apartment: current.apartment_number,
                  })}
                </p>
              )}
            </Section>
          )}

          {/* Quick actions */}
          <Section title={t('detail.contactInfo')}>
            <div className="space-y-2">
              <ContactAction
                href={resident.phone ? `tel:${resident.phone}` : undefined}
                icon={Phone}
                label={t('detail.callPhone')}
                disabled={!resident.phone}
              />
              <ContactAction
                href={
                  resident.phone
                    ? `https://wa.me/${resident.phone.replace(/[^\d]/g, '')}`
                    : undefined
                }
                icon={MessageCircle}
                label={t('detail.whatsappContact')}
                disabled={!resident.phone}
                external
              />
              <ContactAction
                href={resident.email ? `mailto:${resident.email}` : undefined}
                icon={Mail}
                label={t('detail.sendEmail')}
                disabled={!resident.email}
              />
            </div>
          </Section>

          {/* Documents */}
          <Section title={t('detail.documents')} icon={FileText}>
            <ResidentDocumentsManager
              residentId={id}
              documents={resident.documents ?? []}
              canManage={canEdit}
              onDocumentsChange={(next) =>
                setResident((prev) =>
                  prev ? { ...prev, documents: next } : prev
                )
              }
            />
          </Section>
        </div>
      </div>

      {/* Bottom back link */}
      <div className="pt-2">
        <Link
          href={`/${locale}/admin/residents`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-[var(--admin-text-muted)] hover:text-navy dark:text-[var(--admin-text)] transition-colors"
        >
          <BackIcon size={14} />
          {t('detail.backToList')}
        </Link>
      </div>
    </div>
  );
}

/* ----- Subcomponents ----- */

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof DoorOpen;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-navy dark:text-[var(--admin-text)] mb-3">
        {Icon && <Icon size={16} className="text-gray-400 dark:text-[var(--admin-text-subtle)]" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function DefRow({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon?: typeof DoorOpen;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-500 dark:text-[var(--admin-text-muted)]">
        {Icon && <Icon size={12} />}
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function SidebarRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof DoorOpen;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-gray-500 dark:text-[var(--admin-text-muted)] text-xs uppercase tracking-wide flex-shrink-0">
        <Icon size={12} />
        {label}
      </dt>
      <dd className="text-end text-sm">{children}</dd>
    </div>
  );
}

function NotProvided({ label }: { label: string }) {
  return <span className="text-gray-400 dark:text-[var(--admin-text-subtle)] italic">{label}</span>;
}

function ContactAction({
  href,
  icon: Icon,
  label,
  disabled,
  external,
}: {
  href?: string;
  icon: typeof Phone;
  label: string;
  disabled?: boolean;
  external?: boolean;
}) {
  const baseClasses =
    'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors w-full';

  if (disabled || !href) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          baseClasses,
          'border-gray-200 dark:border-[var(--admin-border)] text-gray-300 dark:text-[var(--admin-text-subtle)] bg-gray-50 dark:bg-[var(--admin-bg)] cursor-not-allowed'
        )}
      >
        <Icon size={14} />
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      {...(external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
      className={cn(
        baseClasses,
        'border-gray-200 dark:border-[var(--admin-border)] text-navy dark:text-[var(--admin-text)] bg-white dark:bg-[var(--admin-surface)] hover:border-coral hover:text-coral'
      )}
    >
      <Icon size={14} />
      {label}
    </a>
  );
}

function AssignmentHistoryItem({
  item,
  isArabic,
  locale,
  t,
}: {
  item: ResidentAssignmentHistoryItem;
  isArabic: boolean;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const isCurrent = item.status === 'active';
  const neighborhood = isArabic
    ? item.building_neighborhood_ar
    : item.building_neighborhood_en;

  return (
    <li
      className={cn(
        'rounded-lg border p-3 transition-colors',
        isCurrent
          ? 'border-coral bg-coral/5 dark:bg-coral/10'
          : 'border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)]'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/${locale}/admin/buildings/${item.building_id}`}
              className="text-sm font-semibold text-navy dark:text-[var(--admin-text)] hover:text-coral transition-colors"
            >
              {neighborhood}
            </Link>
            {isCurrent && (
              <StatusBadge
                label={t('status.active')}
                variant="success"
              />
            )}
            {!isCurrent && (
              <StatusBadge label={t('status.checked_out')} variant="neutral" />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mt-0.5">
            {item.room_number
              ? t('card.roomLabel', { number: item.room_number })
              : t('card.notAssigned')}
            {item.floor !== null && (
              <span className="ms-2">
                {t('card.floorLabel', { floor: item.floor })}
              </span>
            )}
          </p>
        </div>
        <div className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] text-end">
          <div className="tabular-nums">
            <span className="text-gray-400 dark:text-[var(--admin-text-subtle)] me-1">{t('detail.checkInLabel')}:</span>
            {formatDate(item.check_in_date, isArabic ? 'ar' : 'en')}
          </div>
          <div className="tabular-nums mt-0.5">
            <span className="text-gray-400 dark:text-[var(--admin-text-subtle)] me-1">{t('detail.checkOutLabel')}:</span>
            {item.check_out_date
              ? formatDate(item.check_out_date, isArabic ? 'ar' : 'en')
              : '—'}
          </div>
        </div>
      </div>
    </li>
  );
}

function ApartmentMateRow({
  mate,
  locale,
  t,
}: {
  mate: ApartmentMate;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const r = mate.resident;
  if (!r) return null;
  const room = mate.rooms?.room_number ?? null;
  return (
    <li>
      <Link
        href={`/${locale}/admin/residents/${r.id}`}
        className="flex items-center gap-3 -mx-2 px-2 py-2 rounded-md hover:bg-gray-50 dark:bg-[var(--admin-bg)] transition-colors"
      >
        <div className="flex-shrink-0">
          {r.profile_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.profile_image}
              alt={r.full_name}
              className="h-9 w-9 rounded-full object-cover bg-gray-100 dark:bg-[var(--admin-surface-2)] border border-gray-200 dark:border-[var(--admin-border)]"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-[var(--admin-surface-2)] border border-gray-200 dark:border-[var(--admin-border)] flex items-center justify-center text-gray-400 dark:text-[var(--admin-text-subtle)]">
              <UsersIcon size={16} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-navy dark:text-[var(--admin-text)] truncate">{r.full_name}</p>
          <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] tabular-nums">
            {room
              ? t('card.roomLabel', { number: room })
              : t('card.notAssigned')}
          </p>
        </div>
        {r.phone && (
          <a
            href={`tel:${r.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 p-1.5 rounded-md text-gray-400 dark:text-[var(--admin-text-subtle)] hover:text-coral hover:bg-coral/5 dark:bg-coral/10 transition-colors"
            aria-label={t('detail.callPhone')}
            title={t('detail.callPhone')}
          >
            <Phone size={14} />
          </a>
        )}
      </Link>
    </li>
  );
}

function MaintenanceHistoryItem({
  item,
  locale,
  isArabic,
}: {
  item: ResidentMaintenanceItem;
  locale: string;
  isArabic: boolean;
}) {
  const tMaint = useTranslations('admin.maintenance');
  const statusLabel = tMaint(`status.${item.status}`);
  const priorityLabel = tMaint(`priority.${item.priority}`);
  const categoryLabel = tMaint(`category.${item.category}`);

  return (
    <li>
      <Link
        href={`/${locale}/admin/maintenance/${item.id}`}
        className="flex items-center justify-between gap-3 py-3 hover:bg-gray-50 dark:bg-[var(--admin-bg)] -mx-2 px-2 rounded-md transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-navy dark:text-[var(--admin-text)] truncate">
            {item.title || '—'}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{categoryLabel}</span>
            <span className="text-gray-300 dark:text-[var(--admin-text-subtle)]">·</span>
            <span className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] tabular-nums">
              {formatDate(item.created_at, isArabic ? 'ar' : 'en')}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <StatusBadge
            label={statusLabel}
            variant={getMaintenanceStatusVariant(item.status)}
          />
          <StatusBadge
            label={priorityLabel}
            variant={getMaintenancePriorityVariant(item.priority)}
          />
        </div>
      </Link>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-32 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse" />
      <div className="space-y-2">
        <div className="h-7 w-64 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse" />
        <div className="h-3 w-48 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5 space-y-3"
            >
              <div className="h-4 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse w-32" />
              <div className="h-3 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse w-full" />
              <div className="h-3 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse w-3/4" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5 space-y-3"
            >
              <div className="h-4 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse w-24" />
              <div className="h-3 bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded animate-pulse w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

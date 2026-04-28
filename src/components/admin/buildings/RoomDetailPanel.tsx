'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  ArrowRight,
  DoorOpen,
  Phone,
  Mail,
  User,
  Wrench,
  Calendar,
  StickyNote,
  ImageOff,
  ExternalLink,
  Hash,
} from 'lucide-react';
import StatusBadge, {
  getRoomStatusVariant,
  getMaintenanceStatusVariant,
  getMaintenancePriorityVariant,
} from '@/components/admin/shared/StatusBadge';
import { formatDate, formatPrice, toWhatsAppUrl } from '@/lib/utils';

interface ResidentLite {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  nationality: string | null;
  profile_image: string | null;
  status: string;
}

interface AssignmentRow {
  id: string;
  resident_id: string;
  check_in_date: string;
  check_out_date: string | null;
  status: 'active' | 'ended';
  created_at: string;
  resident: ResidentLite | null;
}

interface MaintenanceRow {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  assigned_staff: { id: string; full_name: string } | null;
}

interface RoomDetail {
  id: string;
  building_id: string;
  room_number: string | null;
  floor: number | null;
  room_type: string;
  bathroom_type: string;
  monthly_price: number;
  discounted_price: number | null;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  images: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  building: {
    id: string;
    slug: string;
    city_en: string;
    city_ar: string;
    neighborhood_en: string;
    neighborhood_ar: string;
  } | null;
  current_assignment: AssignmentRow | null;
  assignment_history: AssignmentRow[];
  maintenance_history: MaintenanceRow[];
}

interface RoomDetailPanelProps {
  roomId: string;
  onBack: () => void;
}

export default function RoomDetailPanel({ roomId, onBack }: RoomDetailPanelProps) {
  const t = useTranslations('admin.buildings.roomDetail');
  const tType = useTranslations('rooms.types');
  const tBath = useTranslations('rooms.bathroom');
  const tStatus = useTranslations('admin.buildings.roomStatus');
  const tMaint = useTranslations('admin.maintenance');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/admin/rooms/${roomId}`);
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        setRoom(json.data);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load room:', err);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !room) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <DoorOpen size={40} className="mx-auto text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-navy">
          {t('notFoundTitle')}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{t('notFoundDescription')}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy/90 transition-colors"
        >
          <BackIcon size={16} />
          {t('backToRooms')}
        </button>
      </div>
    );
  }

  const hasDiscount =
    room.discounted_price !== null && room.discounted_price < room.monthly_price;
  const occupant = room.current_assignment?.resident;

  return (
    <div className="space-y-4">
      {/* Top strip — back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-navy transition-colors w-fit"
      >
        <BackIcon size={16} />
        {t('backToRooms')}
      </button>

      {/* Header card */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-coral/10 text-coral flex items-center justify-center flex-shrink-0">
              <DoorOpen size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-navy">
                {room.room_number ? (
                  t('roomTitle', { number: room.room_number })
                ) : (
                  <span className="text-gray-400">{t('unnumbered')}</span>
                )}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {tType(room.room_type)} &middot; {tBath(room.bathroom_type)}
                {room.floor !== null && ` · ${t('floorN', { n: room.floor })}`}
              </p>
            </div>
          </div>
          <StatusBadge
            label={tStatus(room.status)}
            variant={getRoomStatusVariant(room.status)}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Pricing */}
          <Section title={t('sections.pricing')} icon={Hash}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <PriceCell
                label={t('monthlyPrice')}
                primary={hasDiscount ? null : formatPrice(room.monthly_price)}
                striked={hasDiscount ? formatPrice(room.monthly_price) : undefined}
                accent={
                  hasDiscount ? formatPrice(room.discounted_price!) : undefined
                }
                currency={t('currency')}
              />
              <PriceCell
                label={t('semesterPrice')}
                primary={formatPrice(
                  (hasDiscount ? room.discounted_price! : room.monthly_price) * 5
                )}
                currency={t('currency')}
                hint={t('semesterHint')}
              />
            </div>
          </Section>

          {/* Current occupant */}
          <Section title={t('sections.currentOccupant')} icon={User}>
            {occupant && room.current_assignment ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-navy/10 text-navy flex items-center justify-center font-medium">
                    {initials(occupant.full_name)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-navy">{occupant.full_name}</p>
                    {occupant.nationality && (
                      <p className="text-xs text-gray-500">{occupant.nationality}</p>
                    )}
                  </div>
                  <StatusBadge label={t('active')} variant="success" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {occupant.phone && (
                    <ContactRow icon={Phone} value={occupant.phone} dir="ltr">
                      <a
                        href={`tel:${occupant.phone}`}
                        className="text-coral hover:underline text-xs"
                      >
                        {t('call')}
                      </a>
                      <a
                        href={toWhatsAppUrl(occupant.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#128C7E] hover:underline text-xs"
                      >
                        {t('whatsapp')}
                      </a>
                    </ContactRow>
                  )}
                  {occupant.email && (
                    <ContactRow icon={Mail} value={occupant.email} dir="ltr" />
                  )}
                  <ContactRow icon={Calendar} value={t('checkInDate')} subtle>
                    <span className="text-navy">
                      {formatDate(room.current_assignment.check_in_date, locale)}
                    </span>
                  </ContactRow>
                  {room.current_assignment.check_out_date && (
                    <ContactRow icon={Calendar} value={t('checkOutDate')} subtle>
                      <span className="text-navy">
                        {formatDate(
                          room.current_assignment.check_out_date,
                          locale
                        )}
                      </span>
                    </ContactRow>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">
                {t('noCurrentOccupant')}
              </p>
            )}
          </Section>

          {/* Assignment history */}
          <Section title={t('sections.assignmentHistory')} icon={Calendar}>
            {room.assignment_history.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                {t('noAssignments')}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {room.assignment_history.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between py-3 gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy truncate">
                        {a.resident?.full_name ?? t('unknownResident')}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(a.check_in_date, locale)}
                        {' — '}
                        {a.check_out_date
                          ? formatDate(a.check_out_date, locale)
                          : t('present')}
                      </p>
                    </div>
                    <StatusBadge
                      label={
                        a.status === 'active' ? t('active') : t('ended')
                      }
                      variant={a.status === 'active' ? 'success' : 'neutral'}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Maintenance history */}
          <Section title={t('sections.maintenanceHistory')} icon={Wrench}>
            {room.maintenance_history.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                {t('noMaintenance')}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {room.maintenance_history.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between py-3 gap-3"
                  >
                    <Link
                      href={`/${locale}/admin/maintenance/${m.id}`}
                      className="min-w-0 flex-1 group"
                    >
                      <p className="text-sm font-medium text-navy truncate group-hover:text-coral transition-colors">
                        {m.title || tMaint(`category.${m.category}`)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {tMaint(`category.${m.category}`)}
                        {' · '}
                        {formatDate(m.created_at, locale)}
                        {m.assigned_staff &&
                          ` · ${m.assigned_staff.full_name}`}
                      </p>
                    </Link>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <StatusBadge
                        label={tMaint(`status.${m.status}`)}
                        variant={getMaintenanceStatusVariant(m.status)}
                      />
                      <StatusBadge
                        label={tMaint(`priority.${m.priority}`)}
                        variant={getMaintenancePriorityVariant(m.priority)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Building reference */}
          {room.building && (
            <Section title={t('sections.building')} icon={DoorOpen}>
              <Link
                href={`/${locale}/admin/buildings/${room.building.id}`}
                className="flex items-center justify-between text-sm text-coral hover:text-coral/80 font-medium"
              >
                <span>
                  {isArabic
                    ? room.building.neighborhood_ar
                    : room.building.neighborhood_en}
                  {' — '}
                  {isArabic ? room.building.city_ar : room.building.city_en}
                </span>
                <ExternalLink size={14} />
              </Link>
            </Section>
          )}

          {/* Photos */}
          <Section title={t('sections.photos')}>
            {room.images && room.images.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {room.images.map((src, i) => (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 hover:border-coral transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <ImageOff size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">{t('noPhotos')}</p>
              </div>
            )}
          </Section>

          {/* Notes */}
          <Section title={t('sections.notes')} icon={StickyNote}>
            {room.notes ? (
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {room.notes}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">{t('noNotes')}</p>
            )}
          </Section>

          {/* Metadata */}
          <Section title={t('sections.metadata')}>
            <dl className="space-y-2 text-sm">
              <Meta label={t('createdAt')}>
                {formatDate(room.created_at, locale)}
              </Meta>
              <Meta label={t('updatedAt')}>
                {formatDate(room.updated_at, locale)}
              </Meta>
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}

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
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-navy mb-3">
        {Icon && <Icon size={16} className="text-gray-400" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function PriceCell({
  label,
  primary,
  striked,
  accent,
  currency,
  hint,
}: {
  label: string;
  primary: string | null;
  striked?: string;
  accent?: string;
  currency: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="mt-1 flex items-baseline gap-2 tabular-nums">
        {accent ? (
          <>
            <span className="text-xl font-bold text-coral">{accent}</span>
            <span className="text-xs text-gray-400 line-through">
              {striked}
            </span>
          </>
        ) : (
          <span className="text-xl font-semibold text-navy">{primary}</span>
        )}
        <span className="text-xs text-gray-500">{currency}</span>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function ContactRow({
  icon: Icon,
  value,
  dir,
  subtle,
  children,
}: {
  icon: typeof Phone;
  value: string;
  dir?: 'ltr' | 'rtl';
  subtle?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon size={14} className="text-gray-400 flex-shrink-0" />
      <span
        className={`truncate ${subtle ? 'text-xs text-gray-500' : 'text-gray-700'}`}
        dir={dir}
      >
        {value}
      </span>
      {children && (
        <span className="ms-auto inline-flex items-center gap-2">
          {children}
        </span>
      )}
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-gray-700">{children}</dd>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase() || '?';
}

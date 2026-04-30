'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  User,
  UserPlus,
  MapPin,
  Clock,
  Send,
  StickyNote,
  CheckCircle,
  XCircle,
  ArrowRight,
  RotateCcw,
  History,
  Calendar,
  Briefcase,
  Bus,
  Heart,
  Megaphone,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import StatusBadge, { getBookingStatusVariant } from '@/components/admin/shared/StatusBadge';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';
import BookingPipelineStepper, { getDepartmentForStatus, getRoleForHandoff } from './BookingPipelineStepper';
import { toWhatsAppUrl, formatDate } from '@/lib/utils';

interface StaffMember {
  id: string;
  full_name: string;
  role?: string;
}

interface BookingNote {
  id: string;
  note: string;
  created_at: string;
  author: { id: string; full_name: string } | null;
}

interface BookingRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  city_interested: string;
  message: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assigned_staff: { id: string; full_name: string } | null;
  date_of_birth: string | null;
  occupation: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  contract_start_date: string | null;
  with_transportation: boolean;
  metadata: {
    medical_issues?: { has_issues: boolean; description?: string | null };
    referral_source?: string;
    room_type?: string;
    bathroom_type?: string;
    building_id?: string;
    resident_id?: string;
  } | null;
}

// Pipeline transitions
const NEXT_STATUS: Record<string, string> = {
  new: 'in_review',
  in_review: 'pending_payment',
  pending_payment: 'pending_onboarding',
  pending_onboarding: 'completed',
};

const ACTION_LABELS: Record<string, string> = {
  new: 'startReview',
  in_review: 'sendToFinance',
  pending_payment: 'sendToSupervision',
  pending_onboarding: 'markComplete',
};

export default function BookingDetail({ bookingId }: { bookingId: string }) {
  const t = useTranslations('admin.bookings');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();

  const [booking, setBooking] = useState<BookingRequest | null>(null);
  const [notes, setNotes] = useState<BookingNote[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Action state
  const [actionLoading, setActionLoading] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [handoffTarget, setHandoffTarget] = useState('');
  const [handoffStaff, setHandoffStaff] = useState<StaffMember[]>([]);
  const [selectedHandoffStaff, setSelectedHandoffStaff] = useState('');

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<'reject' | 'cancel' | null>(null);

  // Note state
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [bookingRes, notesRes, staffRes] = await Promise.all([
          fetch(`/api/booking-requests/${bookingId}`),
          fetch(`/api/booking-requests/${bookingId}/notes`),
          fetch('/api/booking-requests/staff'),
        ]);

        if (bookingRes.ok) {
          const data = await bookingRes.json();
          setBooking(data);
        }
        if (notesRes.ok) {
          setNotes(await notesRes.json());
        }
        if (staffRes.ok) {
          setStaffList(await staffRes.json());
        }
      } catch (error) {
        console.error('Failed to fetch booking details:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [bookingId]);

  const updateBooking = async (newStatus: string, assignedTo?: string | null) => {
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = { status: newStatus };
      if (assignedTo !== undefined) body.assigned_to = assignedTo;

      const res = await fetch(`/api/booking-requests/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const updated = await res.json();
        setBooking(updated);
        setShowHandoff(false);
        setSelectedHandoffStaff('');
        // Refresh notes to show auto-logged status change
        const notesRes = await fetch(`/api/booking-requests/${bookingId}/notes`);
        if (notesRes.ok) setNotes(await notesRes.json());
      }
    } catch (error) {
      console.error('Failed to update:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrimaryAction = async () => {
    if (!booking) return;
    const nextStatus = NEXT_STATUS[booking.status];
    if (!nextStatus) return;

    // Check if this handoff needs staff assignment
    const role = getRoleForHandoff(nextStatus);
    if (role) {
      // Show handoff UI with filtered staff
      setHandoffTarget(nextStatus);
      setShowHandoff(true);
      try {
        const res = await fetch(`/api/booking-requests/staff?role=${role}`);
        if (res.ok) {
          const staff = await res.json();
          setHandoffStaff(staff);
        }
      } catch {
        setHandoffStaff([]);
      }
    } else {
      // Direct transition (no role filter needed)
      await updateBooking(nextStatus);
    }
  };

  const handleHandoffConfirm = async () => {
    await updateBooking(handoffTarget, selectedHandoffStaff || null);
  };

  const handleReject = () => {
    setConfirmAction(null);
    updateBooking('rejected');
  };
  const handleCancel = () => {
    setConfirmAction(null);
    updateBooking('cancelled');
  };
  const handleReopen = () => updateBooking('new', null);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/booking-requests/${bookingId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotes((prev) => [note, ...prev]);
        setNewNote('');
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setAddingNote(false);
    }
  };

  const formatDateTime = (dateStr: string) => formatDate(dateStr, isArabic ? 'ar' : 'en', { includeTime: true });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 dark:bg-[var(--admin-border)] rounded animate-pulse" />
        <div className="h-24 bg-gray-200 dark:bg-[var(--admin-border)] rounded-xl animate-pulse" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-64 bg-gray-200 dark:bg-[var(--admin-border)] rounded-xl animate-pulse" />
            <div className="h-48 bg-gray-200 dark:bg-[var(--admin-border)] rounded-xl animate-pulse" />
          </div>
          <div className="h-96 bg-gray-200 dark:bg-[var(--admin-border)] rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-[var(--admin-text-muted)]">Booking request not found</p>
      </div>
    );
  }

  const department = getDepartmentForStatus(booking.status);
  const nextStatus = NEXT_STATUS[booking.status];
  const actionLabel = ACTION_LABELS[booking.status];
  const isTerminal = booking.status === 'completed' || booking.status === 'rejected' || booking.status === 'cancelled';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin/bookings')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:bg-[var(--admin-surface-2)] transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-[var(--admin-text-muted)]" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-navy dark:text-[var(--admin-text)]">{t('detail.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">
            {t('detail.createdAt')}: {formatDateTime(booking.created_at)}
          </p>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <BookingPipelineStepper status={booking.status} />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact info */}
          <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
            <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-4">
              {t('detail.contactInfo')}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                  <User size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('table.name')}</p>
                  <p className="font-medium text-navy dark:text-[var(--admin-text)]">{booking.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                  <Mail size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('table.email')}</p>
                  <p className="font-medium text-navy dark:text-[var(--admin-text)]">{booking.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                  <Phone size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('table.phone')}</p>
                  <p className="font-medium text-navy dark:text-[var(--admin-text)]" dir="ltr">{booking.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                  <MapPin size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('table.city')}</p>
                  <p className="font-medium text-navy dark:text-[var(--admin-text)] capitalize">{booking.city_interested}</p>
                </div>
              </div>
            </div>

            {/* Contact actions */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-[var(--admin-border)]">
              <a
                href={`mailto:${booking.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
              >
                <Mail size={14} />
                {t('detail.sendEmail')}
              </a>
              <a
                href={`tel:${booking.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
              >
                <Phone size={14} />
                {t('detail.callPhone')}
              </a>
              <a
                href={toWhatsAppUrl(booking.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#25D366]/10 text-[#128C7E] rounded-lg hover:bg-[#25D366]/20 transition-colors"
              >
                <MessageCircle size={14} />
                {t('detail.whatsapp')}
              </a>
            </div>
          </div>

          {/* Personal Info & Emergency Contact */}
          {(booking.date_of_birth || booking.occupation || booking.emergency_contact_name) && (
            <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
              <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-4">
                {t('detail.personalInfo')}
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {booking.date_of_birth && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                      <Calendar size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('detail.dateOfBirth')}</p>
                      <p className="font-medium text-navy dark:text-[var(--admin-text)]" dir="ltr">
                        {formatDate(booking.date_of_birth, 'en')}
                      </p>
                    </div>
                  </div>
                )}
                {booking.occupation && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                      <Briefcase size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('detail.occupation')}</p>
                      <p className="font-medium text-navy dark:text-[var(--admin-text)]">
                        {t(`detail.occupationValues.${booking.occupation}`)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Emergency Contact */}
              {booking.emergency_contact_name && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[var(--admin-border)]">
                  <h3 className="text-sm font-semibold text-navy dark:text-[var(--admin-text)] mb-3 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-orange-500 dark:text-orange-400" />
                    {t('detail.emergencyContact')}
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                        <User size={16} className="text-orange-500 dark:text-orange-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('detail.emergencyContactName')}</p>
                        <p className="font-medium text-navy dark:text-[var(--admin-text)]">{booking.emergency_contact_name}</p>
                      </div>
                    </div>
                    {booking.emergency_contact_phone && (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                          <Phone size={16} className="text-orange-500 dark:text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('detail.emergencyContactPhone')}</p>
                          <p className="font-medium text-navy dark:text-[var(--admin-text)]" dir="ltr">{booking.emergency_contact_phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contract Details */}
          {(booking.contract_start_date || booking.with_transportation !== undefined) && (
            <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
              <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-4">
                {t('detail.contractDetails')}
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {booking.contract_start_date && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                      <Calendar size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('detail.contractStartDate')}</p>
                      <p className="font-medium text-navy dark:text-[var(--admin-text)]" dir="ltr">
                        {formatDate(booking.contract_start_date, 'en')}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                    <Bus size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('detail.transportation')}</p>
                    <p className="font-medium text-navy dark:text-[var(--admin-text)]">
                      {booking.with_transportation ? t('detail.withTransportation') : t('detail.withoutTransportation')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Info (medical + referral) */}
          {booking.metadata && (booking.metadata.medical_issues || booking.metadata.referral_source) && (
            <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
              <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-4">
                {t('detail.additionalInfo')}
              </h2>
              <div className="space-y-4">
                {booking.metadata.medical_issues && (
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center flex-shrink-0">
                      <Heart size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('detail.medicalIssues')}</p>
                      <p className="font-medium text-navy dark:text-[var(--admin-text)]">
                        {booking.metadata.medical_issues.has_issues
                          ? booking.metadata.medical_issues.description || t('detail.notProvided')
                          : t('detail.noMedicalIssues')}
                      </p>
                    </div>
                  </div>
                )}
                {booking.metadata.referral_source && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                      <Megaphone size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('detail.referralSource')}</p>
                      <p className="font-medium text-navy dark:text-[var(--admin-text)]">
                        {t(`detail.referralValues.${booking.metadata.referral_source}`)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Message */}
          <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
            <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-3">
              {t('detail.message')}
            </h2>
            <p className="text-gray-700 dark:text-[var(--admin-text-muted)] whitespace-pre-wrap leading-relaxed">
              {booking.message}
            </p>
          </div>

          {/* Notes section */}
          <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
            <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-4">
              {t('notes.title')}
            </h2>

            {/* Add note form */}
            <div className="flex gap-2 mb-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={t('notes.placeholder')}
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-[var(--admin-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral resize-none"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || addingNote}
                className="px-4 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
              >
                {addingNote ? (
                  t('notes.submitting')
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Send size={14} />
                    {t('notes.submit')}
                  </span>
                )}
              </button>
            </div>

            {/* User notes list */}
            {(() => {
              const userNotes = notes.filter(n => !n.note.startsWith('[system]'));
              return userNotes.length === 0 ? (
                <div className="text-center py-6">
                  <StickyNote size={24} className="mx-auto text-gray-300 dark:text-[var(--admin-text-subtle)] mb-2" />
                  <p className="text-sm text-gray-400 dark:text-[var(--admin-text-subtle)]">{t('notes.empty')}</p>
                  <p className="text-xs text-gray-300 dark:text-[var(--admin-text-subtle)] mt-1">{t('notes.emptyDescription')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg p-3 border bg-gray-50 dark:bg-[var(--admin-bg)] border-gray-100 dark:border-[var(--admin-border)]"
                    >
                      <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-[var(--admin-text-muted)]">
                        {note.note}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 dark:text-[var(--admin-text-subtle)]">
                        <span className="font-medium">
                          {note.author?.full_name}
                        </span>
                        <span>&middot;</span>
                        <span>{formatDateTime(note.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Activity Log section */}
          <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
            <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-4 flex items-center gap-2">
              <History size={18} />
              {t('activityLog.title')}
            </h2>

            {(() => {
              const systemNotes = notes.filter(n => n.note.startsWith('[system]'));
              return (
                <div className="space-y-3">
                  {/* Status change events */}
                  {systemNotes.map((note) => {
                    const raw = note.note.replace('[system] ', '');
                    const match = raw.match(/^Status changed: (\w+) → (\w+)$/);
                    const displayText = match
                      ? t('notes.statusChanged', {
                          from: t(`status.${match[1]}`),
                          to: t(`status.${match[2]}`)
                        })
                      : raw;
                    return (
                      <div
                        key={note.id}
                        className="rounded-lg p-3 border bg-blue-50/50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20"
                      >
                        <p className="text-sm whitespace-pre-wrap text-blue-700 dark:text-blue-400 italic">
                          {displayText}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 dark:text-[var(--admin-text-subtle)]">
                          <span className="font-medium">
                            {note.author?.full_name || t('notes.system')}
                          </span>
                          <span>&middot;</span>
                          <span>{formatDateTime(note.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Creation event — always shown at the bottom (oldest) */}
                  <div className="rounded-lg p-3 border bg-gray-50 dark:bg-[var(--admin-bg)] border-gray-200 dark:border-[var(--admin-border)]">
                    <p className="text-sm text-gray-600 dark:text-[var(--admin-text-muted)] italic flex items-center gap-1.5">
                      <Clock size={14} className="text-gray-400 dark:text-[var(--admin-text-subtle)]" />
                      {t('activityLog.created')}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 dark:text-[var(--admin-text-subtle)]">
                      <span>{formatDateTime(booking.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status & Actions */}
          <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
            <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-4">
              {t('detail.assignment')}
            </h2>

            <div className="space-y-4">
              {/* Current status */}
              <div>
                <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-1.5">{t('table.status')}</p>
                <StatusBadge
                  label={t(`status.${booking.status}`)}
                  variant={getBookingStatusVariant(booking.status)}
                />
              </div>

              {/* Department */}
              {department && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-1.5">{t('detail.currentDepartment')}</p>
                  <p className="text-sm font-medium text-navy dark:text-[var(--admin-text)]">
                    {t(`pipeline.department.${department}`)}
                  </p>
                </div>
              )}

              {/* Assigned to */}
              <div>
                <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-1.5">{t('detail.assignedTo')}</p>
                <p className="text-sm font-medium text-navy dark:text-[var(--admin-text)]">
                  {booking.assigned_staff?.full_name || (
                    <span className="text-gray-400 dark:text-[var(--admin-text-subtle)]">{t('table.unassigned')}</span>
                  )}
                </p>
              </div>

              {/* Handoff modal */}
              {showHandoff && (
                <div className="bg-gray-50 dark:bg-[var(--admin-bg)] rounded-lg p-3 border border-gray-200 dark:border-[var(--admin-border)] space-y-3">
                  <p className="text-sm font-medium text-navy dark:text-[var(--admin-text)]">
                    {t('detail.assignTo')}
                  </p>
                  <select
                    value={selectedHandoffStaff}
                    onChange={(e) => setSelectedHandoffStaff(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-[var(--admin-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral bg-white dark:bg-[var(--admin-surface)]"
                  >
                    <option value="">{t('detail.selectStaff')}</option>
                    {handoffStaff.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleHandoffConfirm}
                      disabled={actionLoading}
                      className="flex-1 px-3 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors"
                    >
                      {t('pipeline.assignAndProceed')}
                    </button>
                    <button
                      onClick={() => setShowHandoff(false)}
                      className="px-3 py-2 text-sm text-gray-600 dark:text-[var(--admin-text-muted)] bg-gray-200 dark:bg-[var(--admin-border)] rounded-lg hover:bg-gray-300 dark:hover:bg-[var(--admin-border)] transition-colors"
                    >
                      {t('deleteConfirm.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!showHandoff && !isTerminal && nextStatus && actionLabel && (
                <button
                  onClick={handlePrimaryAction}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-coral text-white text-sm font-semibold rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {booking.status === 'pending_onboarding' ? (
                    <CheckCircle size={16} />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                  {t(`pipeline.actions.${actionLabel}`)}
                </button>
              )}

              {/* Reject / Cancel (only for active statuses) */}
              {!showHandoff && !isTerminal && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmAction('reject')}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                  >
                    <XCircle size={14} />
                    {t('pipeline.actions.reject')}
                  </button>
                  <button
                    onClick={() => setConfirmAction('cancel')}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-[var(--admin-text-muted)] bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-lg hover:bg-gray-200 dark:bg-[var(--admin-border)] disabled:opacity-50 transition-colors"
                  >
                    <XCircle size={14} />
                    {t('pipeline.actions.cancel')}
                  </button>
                </div>
              )}

              {/* Reopen (for rejected/cancelled) */}
              {(booking.status === 'rejected' || booking.status === 'cancelled') && (
                <button
                  onClick={handleReopen}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-navy dark:text-[var(--admin-text)] bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-lg hover:bg-gray-200 dark:bg-[var(--admin-border)] disabled:opacity-50 transition-colors"
                >
                  <RotateCcw size={14} />
                  {t('pipeline.actions.reopen')}
                </button>
              )}

              {/* Convert to resident (only when completed and not yet linked) */}
              {booking.status === 'completed' && !booking.metadata?.resident_id && (
                <Link
                  href={`/${locale}/admin/residents/new?from_booking=${booking.id}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-coral text-white text-sm font-semibold rounded-lg hover:bg-coral/90 transition-colors shadow-sm"
                >
                  <UserPlus size={16} />
                  {t('pipeline.actions.convertToResident')}
                </Link>
              )}

              {/* View resident link (already linked) */}
              {booking.status === 'completed' && booking.metadata?.resident_id && (
                <Link
                  href={`/${locale}/admin/residents/${booking.metadata.resident_id}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                >
                  <User size={14} />
                  {t('pipeline.actions.viewResident')}
                </Link>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={confirmAction === 'reject'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleReject}
        title={t('pipeline.actions.reject')}
        description={t('deleteConfirm.description')}
        confirmLabel={t('pipeline.actions.reject')}
        cancelLabel={t('deleteConfirm.cancel')}
        variant="danger"
        loading={actionLoading}
      />
      <ConfirmDialog
        isOpen={confirmAction === 'cancel'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleCancel}
        title={t('pipeline.actions.cancel')}
        description={t('deleteConfirm.description')}
        confirmLabel={t('pipeline.actions.cancel')}
        cancelLabel={t('deleteConfirm.cancel')}
        variant="warning"
        loading={actionLoading}
      />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageCircle,
  User,
  MapPin,
  Clock,
  Send,
  StickyNote,
  CheckCircle,
  XCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import StatusBadge, { getBookingStatusVariant } from '@/components/admin/shared/StatusBadge';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';
import BookingPipelineStepper, { getDepartmentForStatus, getRoleForHandoff } from './BookingPipelineStepper';
import { toWhatsAppUrl } from '@/lib/utils';

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-24 bg-gray-200 rounded-xl animate-pulse" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
            <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
          </div>
          <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Booking request not found</p>
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
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-navy">{t('detail.title')}</h1>
          <p className="text-sm text-gray-500">
            {t('detail.createdAt')}: {formatDate(booking.created_at)}
          </p>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <BookingPipelineStepper status={booking.status} />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-navy mb-4">
              {t('detail.contactInfo')}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <User size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('table.name')}</p>
                  <p className="font-medium text-navy">{booking.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Mail size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('table.email')}</p>
                  <p className="font-medium text-navy">{booking.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Phone size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('table.phone')}</p>
                  <p className="font-medium text-navy" dir="ltr">{booking.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <MapPin size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('table.city')}</p>
                  <p className="font-medium text-navy capitalize">{booking.city_interested}</p>
                </div>
              </div>
            </div>

            {/* Contact actions */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
              <a
                href={`mailto:${booking.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Mail size={14} />
                {t('detail.sendEmail')}
              </a>
              <a
                href={`tel:${booking.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
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

          {/* Message */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-navy mb-3">
              {t('detail.message')}
            </h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {booking.message}
            </p>
          </div>

          {/* Notes section */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-navy mb-4">
              {t('notes.title')}
            </h2>

            {/* Add note form */}
            <div className="flex gap-2 mb-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={t('notes.placeholder')}
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral resize-none"
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

            {/* Notes list */}
            {notes.length === 0 ? (
              <div className="text-center py-6">
                <StickyNote size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">{t('notes.empty')}</p>
                <p className="text-xs text-gray-300 mt-1">{t('notes.emptyDescription')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => {
                  const isSystem = note.note.startsWith('[system]');
                  return (
                    <div
                      key={note.id}
                      className={`rounded-lg p-3 border ${
                        isSystem
                          ? 'bg-blue-50/50 border-blue-100'
                          : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <p className={`text-sm whitespace-pre-wrap ${
                        isSystem ? 'text-blue-700 italic' : 'text-gray-700'
                      }`}>
                        {isSystem ? (() => {
                          const raw = note.note.replace('[system] ', '');
                          const match = raw.match(/^Status changed: (\w+) → (\w+)$/);
                          if (match) {
                            return t('notes.statusChanged', {
                              from: t(`status.${match[1]}`),
                              to: t(`status.${match[2]}`)
                            });
                          }
                          return raw;
                        })() : note.note}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span className="font-medium">
                          {note.author?.full_name || t('notes.system')}
                        </span>
                        <span>&middot;</span>
                        <span>{formatDate(note.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status & Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-navy mb-4">
              {t('detail.assignment')}
            </h2>

            <div className="space-y-4">
              {/* Current status */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">{t('table.status')}</p>
                <StatusBadge
                  label={t(`status.${booking.status}`)}
                  variant={getBookingStatusVariant(booking.status)}
                />
              </div>

              {/* Department */}
              {department && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">{t('detail.currentDepartment')}</p>
                  <p className="text-sm font-medium text-navy">
                    {t(`pipeline.department.${department}`)}
                  </p>
                </div>
              )}

              {/* Assigned to */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">{t('detail.assignedTo')}</p>
                <p className="text-sm font-medium text-navy">
                  {booking.assigned_staff?.full_name || (
                    <span className="text-gray-400">{t('table.unassigned')}</span>
                  )}
                </p>
              </div>

              {/* Handoff modal */}
              {showHandoff && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-3">
                  <p className="text-sm font-medium text-navy">
                    {t('detail.assignTo')}
                  </p>
                  <select
                    value={selectedHandoffStaff}
                    onChange={(e) => setSelectedHandoffStaff(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral bg-white"
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
                      className="px-3 py-2 text-sm text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
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
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    <XCircle size={14} />
                    {t('pipeline.actions.reject')}
                  </button>
                  <button
                    onClick={() => setConfirmAction('cancel')}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
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
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-navy bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  <RotateCcw size={14} />
                  {t('pipeline.actions.reopen')}
                </button>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} className="text-gray-400" />
                <span className="text-gray-500">{t('detail.createdAt')}:</span>
                <span className="text-navy">{formatDate(booking.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} className="text-gray-400" />
                <span className="text-gray-500">{t('detail.updatedAt')}:</span>
                <span className="text-navy">{formatDate(booking.updated_at)}</span>
              </div>
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

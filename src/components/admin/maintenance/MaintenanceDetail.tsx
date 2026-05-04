'use client';

import { useState, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  User,
  Clock,
  Send,
  StickyNote,
  CheckCircle,
  XCircle,
  Building2,
  DoorOpen,
  Play,
  RotateCcw,
  ClipboardCheck,
  ImageIcon,
  Plus,
  Loader2,
  History,
} from 'lucide-react';
import StatusBadge, {
  getMaintenanceStatusVariant,
  getMaintenancePriorityVariant,
} from '@/components/admin/shared/StatusBadge';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';
import MaintenancePipelineStepper from './MaintenancePipelineStepper';
import { toWhatsAppUrl, formatDate } from '@/lib/utils';
import { isAutoApartmentNumber } from '@/lib/apartments/auto-name';
import { showUndoToast } from '@/lib/admin/undoToast';

interface StaffMember {
  id: string;
  full_name: string;
}

interface MaintenanceNote {
  id: string;
  note: string;
  created_at: string;
  author: { id: string; full_name: string } | null;
}

interface MaintenanceRequest {
  id: string;
  description: string | null;
  extra_details: string | null;
  category: string;
  priority: string;
  status: string;
  requester_name: string | null;
  requester_phone: string | null;
  room_number: string | null;
  room_id: string | null;
  apartment_id: string | null;
  apartment: { id: string; apartment_number: string; floor: number } | null;
  photos: string[] | null;
  resolution_notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  building: {
    id: string;
    slug: string;
    neighborhood_en: string;
    neighborhood_ar: string;
    city_en: string;
    city_ar: string;
  } | null;
  assigned_staff: { id: string; full_name: string } | null;
}

const MAINTENANCE_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export default function MaintenanceDetail({ requestId }: { requestId: string }) {
  const t = useTranslations('admin.maintenance');
  const tUndo = useTranslations('admin.undo');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const router = useRouter();

  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [notes, setNotes] = useState<MaintenanceNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Action state
  const [actionLoading, setActionLoading] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignStaff, setAssignStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('medium');

  // Resolution notes
  const [editResolutionNotes, setEditResolutionNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Confirm dialog state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  // Note state
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Photo state
  const [photoUrls, setPhotoUrls] = useState<{ path: string; url: string }[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [reqRes, notesRes] = await Promise.all([
          fetch(`/api/maintenance-requests/${requestId}`),
          fetch(`/api/maintenance-requests/${requestId}/notes`),
        ]);

        if (reqRes.ok) {
          const data = await reqRes.json();
          setRequest(data);
          setEditResolutionNotes(data.resolution_notes || '');
        }
        if (notesRes.ok) {
          setNotes(await notesRes.json());
        }
      } catch (error) {
        console.error('Failed to fetch maintenance request details:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [requestId]);

  // Fetch signed URLs for photos
  useEffect(() => {
    if (!request?.photos || request.photos.length === 0) {
      setPhotoUrls([]);
      return;
    }
    async function fetchPhotoUrls() {
      try {
        const res = await fetch(`/api/uploads/maintenance-photo/signed-urls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths: request!.photos }),
        });
        if (res.ok) {
          const data = await res.json();
          setPhotoUrls(data.urls || []);
        }
      } catch {
        // Silently fail
      }
    }
    fetchPhotoUrls();
  }, [request?.photos]);

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !request) return;

    // Validate
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('requestId', request.id);

      const uploadRes = await fetch('/api/uploads/maintenance-photo', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const { path } = await uploadRes.json();
        const newPhotos = [...(request.photos || []), path];

        const patchRes = await fetch(`/api/maintenance-requests/${request.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photos: newPhotos }),
        });

        if (patchRes.ok) {
          const updated = await patchRes.json();
          setRequest(updated);
        }
      }
    } catch (error) {
      console.error('Failed to upload photo:', error);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const updateRequest = async (updates: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/maintenance-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const updated = await res.json();
        setRequest(updated);
        setShowAssignForm(false);
        setSelectedStaff('');
        // Refresh notes for auto-logged transitions
        const notesRes = await fetch(`/api/maintenance-requests/${requestId}/notes`);
        if (notesRes.ok) setNotes(await notesRes.json());
      }
    } catch (error) {
      console.error('Failed to update:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignReview = async () => {
    // Show assign form with priority picker + staff dropdown
    setShowAssignForm(true);
    setSelectedPriority(request?.priority || 'medium');
    try {
      const res = await fetch('/api/maintenance-requests/staff?role=maintenance_staff,maintenance_manager');
      if (res.ok) {
        const staff = await res.json();
        setAssignStaff(staff);
        // If no maintenance staff/manager found, fetch all staff as fallback
        if (staff.length === 0) {
          const allRes = await fetch('/api/maintenance-requests/staff');
          if (allRes.ok) setAssignStaff(await allRes.json());
        }
      }
    } catch {
      setAssignStaff([]);
    }
  };

  const handleAssignConfirm = () => {
    updateRequest({
      status: 'assigned',
      priority: selectedPriority,
      assigned_to: selectedStaff || null,
    });
  };

  const handleStartWork = () => updateRequest({ status: 'in_progress' });
  const handleComplete = () => updateRequest({ status: 'completed' });
  const handleReject = () => {
    setShowRejectConfirm(false);
    updateRequest({ status: 'rejected' });
  };
  const handleCancel = async () => {
    setShowCancelConfirm(false);
    const priorStatus = request?.status;
    const priorAssignedTo = request?.assigned_to ?? null;
    await updateRequest({ status: 'cancelled' });
    if (!priorStatus || priorStatus === 'cancelled') return;
    showUndoToast({
      message: tUndo('maintenanceCancelled'),
      undoLabel: tUndo('label'),
      restoredMessage: tUndo('restored'),
      failedMessage: tUndo('failed'),
      onUndo: async () => {
        const res = await fetch(`/api/maintenance-requests/${requestId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: priorStatus, assigned_to: priorAssignedTo }),
        });
        if (!res.ok) return false;
        const updated = await res.json();
        setRequest(updated);
        const notesRes = await fetch(`/api/maintenance-requests/${requestId}/notes`);
        if (notesRes.ok) setNotes(await notesRes.json());
        return true;
      },
    });
  };
  const handleReopen = () => updateRequest({ status: 'submitted', assigned_to: null });

  const handleSaveResolutionNotes = async () => {
    setSavingNotes(true);
    try {
      await fetch(`/api/maintenance-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_notes: editResolutionNotes || null }),
      });
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/maintenance-requests/${requestId}/notes`, {
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

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-[var(--admin-text-muted)]">
          {isArabic ? 'طلب الصيانة غير موجود' : 'Maintenance request not found'}
        </p>
      </div>
    );
  }

  const isTerminal = request.status === 'completed' || request.status === 'rejected' || request.status === 'cancelled';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin/maintenance')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:bg-[var(--admin-surface-2)] transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-[var(--admin-text-muted)]" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-navy dark:text-[var(--admin-text)]">{t('detail.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-[var(--admin-text-muted)]">
            {t('detail.createdAt')}: {formatDateTime(request.created_at)}
          </p>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <MaintenancePipelineStepper
        status={request.status}
        cancelledAtStep={
          request.status === 'cancelled' || request.status === 'rejected'
            ? notes.find(n => n.note.includes(`\u2192 ${request.status}`))?.note.match(/Status changed: (\w+) \u2192/)?.[1]
            : undefined
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Requester info */}
          <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
            <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-4">
              {t('detail.requesterInfo')}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                  <User size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('table.requester')}</p>
                  <p className="font-medium text-navy dark:text-[var(--admin-text)]">
                    {request.requester_name || (isArabic ? 'غير محدد' : 'Not specified')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                  <Phone size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{isArabic ? 'الجوال' : 'Phone'}</p>
                  <p className="font-medium text-navy dark:text-[var(--admin-text)]" dir="ltr">
                    {request.requester_phone || (isArabic ? 'غير محدد' : 'Not specified')}
                  </p>
                </div>
              </div>
              {request.apartment && (() => {
                const isAuto = isAutoApartmentNumber(request.apartment.apartment_number);
                const floorLabel = t('detail.floorN', { n: request.apartment.floor });
                return (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                      <Building2 size={16} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">
                        {t('detail.apartmentLabel')}
                      </p>
                      <p
                        className="font-medium text-navy dark:text-[var(--admin-text)] tabular-nums"
                        dir={isAuto ? undefined : 'ltr'}
                      >
                        {isAuto ? (
                          floorLabel
                        ) : (
                          <>
                            {request.apartment.apartment_number}
                            <span className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] ms-1">
                              · {floorLabel}
                            </span>
                          </>
                        )}
                      </p>
                      {!request.room_id && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium mt-0.5">
                          {t('detail.apartmentSharedBadge')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
              {request.room_number && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-[var(--admin-surface-2)] flex items-center justify-center">
                    <DoorOpen size={16} className="text-gray-500 dark:text-[var(--admin-text-muted)]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">{t('detail.roomNumber')}</p>
                    <p className="font-medium text-navy dark:text-[var(--admin-text)]">{request.room_number}</p>
                  </div>
                </div>
              )}
            </div>

            {request.requester_phone && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-[var(--admin-border)]">
                <a
                  href={`tel:${request.requester_phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
                >
                  <Phone size={14} />
                  {t('detail.callPhone')}
                </a>
                <a
                  href={toWhatsAppUrl(request.requester_phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#25D366]/10 text-[#128C7E] rounded-lg hover:bg-[#25D366]/20 transition-colors"
                >
                  <MessageCircle size={14} />
                  {t('detail.whatsapp')}
                </a>
              </div>
            )}
          </div>

          {/* Issue Details */}
          <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
            <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-3">
              {t('detail.issueDetails')}
            </h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <StatusBadge label={t(`category.${request.category}`)} variant="info" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-1">{t('table.summary')}</p>
                <p className="font-medium text-navy dark:text-[var(--admin-text)] whitespace-pre-wrap leading-relaxed">
                  {request.description || t('detail.noSummary')}
                </p>
              </div>
              {request.extra_details && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-1">{t('detail.extraDetails')}</p>
                  <p className="text-gray-700 dark:text-[var(--admin-text-muted)] whitespace-pre-wrap leading-relaxed">
                    {request.extra_details}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Photos */}
          <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)]">
                {t('detail.photos')}
              </h2>
              <div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAddPhoto}
                  className="hidden"
                />
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-[var(--admin-surface-2)] text-navy dark:text-[var(--admin-text)] font-medium rounded-lg hover:bg-gray-200 dark:bg-[var(--admin-border)] disabled:opacity-50 transition-colors"
                >
                  {uploadingPhoto ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t('detail.uploadingPhoto')}
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      {t('detail.addPhoto')}
                    </>
                  )}
                </button>
              </div>
            </div>

            {photoUrls.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photoUrls.map((photo, i) => (
                  <a
                    key={i}
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-[var(--admin-border)] hover:border-coral transition-colors group"
                  >
                    <img
                      src={photo.url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <ImageIcon size={24} className="mx-auto text-gray-300 dark:text-[var(--admin-text-subtle)] mb-2" />
                <p className="text-sm text-gray-400 dark:text-[var(--admin-text-subtle)]">{t('detail.noPhotos')}</p>
              </div>
            )}
          </div>

          {/* Resolution Notes */}
          <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
            <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-3">
              {t('detail.resolutionNotes')}
            </h2>
            <textarea
              value={editResolutionNotes}
              onChange={(e) => setEditResolutionNotes(e.target.value)}
              placeholder={t('detail.resolutionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[var(--admin-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral resize-none"
            />
            <button
              onClick={handleSaveResolutionNotes}
              disabled={savingNotes}
              className="mt-2 px-4 py-1.5 bg-gray-100 dark:bg-[var(--admin-surface-2)] text-navy dark:text-[var(--admin-text)] text-sm font-medium rounded-lg hover:bg-gray-200 dark:bg-[var(--admin-border)] disabled:opacity-50 transition-colors"
            >
              {savingNotes ? t('detail.saving') : t('detail.save')}
            </button>
          </div>

          {/* Notes section */}
          <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
            <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-4">
              {t('notes.title')}
            </h2>

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
                        <span className="font-medium">{note.author?.full_name}</span>
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
                  {/* Completion event */}
                  {request.completed_at && (
                    <div className="rounded-lg p-3 border bg-green-50/50 dark:bg-green-500/10 border-green-100 dark:border-green-500/20">
                      <p className="text-sm text-green-700 dark:text-green-400 italic flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-green-500 dark:text-green-400" />
                        {t('activityLog.completed')}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 dark:text-[var(--admin-text-subtle)]">
                        <span>{formatDateTime(request.completed_at)}</span>
                      </div>
                    </div>
                  )}

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
                          <span className="font-medium">{note.author?.full_name || t('notes.system')}</span>
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
                      <span>{formatDateTime(request.created_at)}</span>
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
              {/* Status + Priority badges */}
              <div className="flex gap-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-1.5">{t('table.status')}</p>
                  <StatusBadge
                    label={t(`status.${request.status}`)}
                    variant={getMaintenanceStatusVariant(request.status)}
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-1.5">{t('table.priority')}</p>
                  <StatusBadge
                    label={t(`priority.${request.priority}`)}
                    variant={getMaintenancePriorityVariant(request.priority)}
                  />
                </div>
              </div>

              {/* Assigned to */}
              <div>
                <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-1.5">{t('detail.assignedTo')}</p>
                <p className="text-sm font-medium text-navy dark:text-[var(--admin-text)]">
                  {request.assigned_staff?.full_name || (
                    <span className="text-gray-400 dark:text-[var(--admin-text-subtle)]">{t('table.unassigned')}</span>
                  )}
                </p>
              </div>

              {/* Assign & Review form (for submitted status) */}
              {showAssignForm && (
                <div className="bg-gray-50 dark:bg-[var(--admin-bg)] rounded-lg p-3 border border-gray-200 dark:border-[var(--admin-border)] space-y-3">
                  {/* Priority */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-1.5 font-medium">{t('pipeline.setPriority')}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MAINTENANCE_PRIORITIES.map((p) => (
                        <button
                          key={p}
                          onClick={() => setSelectedPriority(p)}
                          className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            selectedPriority === p
                              ? 'border-coral bg-coral text-white'
                              : 'border-gray-200 dark:border-[var(--admin-border)] bg-white dark:bg-[var(--admin-surface)] text-gray-600 dark:text-[var(--admin-text-muted)] hover:border-gray-300 dark:border-[var(--admin-border)]'
                          }`}
                        >
                          {t(`priority.${p}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Staff */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] mb-1.5 font-medium">{t('pipeline.selectTechnician')}</p>
                    <select
                      value={selectedStaff}
                      onChange={(e) => setSelectedStaff(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-[var(--admin-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral bg-white dark:bg-[var(--admin-surface)]"
                    >
                      <option value="">{t('detail.selectStaff')}</option>
                      {assignStaff.map((s) => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAssignConfirm}
                      disabled={actionLoading}
                      className="flex-1 px-3 py-2 bg-coral text-white text-sm font-medium rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors"
                    >
                      {t('pipeline.assignAndProceed')}
                    </button>
                    <button
                      onClick={() => setShowAssignForm(false)}
                      className="px-3 py-2 text-sm text-gray-600 dark:text-[var(--admin-text-muted)] bg-gray-200 dark:bg-[var(--admin-border)] rounded-lg hover:bg-gray-300 dark:hover:bg-[var(--admin-border)] transition-colors"
                    >
                      {t('deleteConfirm.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!showAssignForm && !isTerminal && (
                <>
                  {request.status === 'submitted' && (
                    <button
                      onClick={handleAssignReview}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-coral text-white text-sm font-semibold rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <ClipboardCheck size={16} />
                      {t('pipeline.actions.assignReview')}
                    </button>
                  )}

                  {request.status === 'assigned' && (
                    <button
                      onClick={handleStartWork}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-coral text-white text-sm font-semibold rounded-lg hover:bg-coral/90 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <Play size={16} />
                      {t('pipeline.actions.startWork')}
                    </button>
                  )}

                  {request.status === 'in_progress' && (
                    <button
                      onClick={handleComplete}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <CheckCircle size={16} />
                      {t('pipeline.actions.markComplete')}
                    </button>
                  )}

                  {/* Reject & Cancel buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRejectConfirm(true)}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                    >
                      <XCircle size={14} />
                      {t('pipeline.actions.reject')}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-[var(--admin-text-muted)] bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-lg hover:bg-gray-200 dark:bg-[var(--admin-border)] disabled:opacity-50 transition-colors"
                    >
                      <XCircle size={14} />
                      {t('pipeline.actions.cancel')}
                    </button>
                  </div>
                </>
              )}

              {/* Reopen */}
              {(request.status === 'rejected' || request.status === 'cancelled') && (
                <button
                  onClick={handleReopen}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-navy dark:text-[var(--admin-text)] bg-gray-100 dark:bg-[var(--admin-surface-2)] rounded-lg hover:bg-gray-200 dark:bg-[var(--admin-border)] disabled:opacity-50 transition-colors"
                >
                  <RotateCcw size={14} />
                  {t('pipeline.actions.reopen')}
                </button>
              )}
            </div>
          </div>

          {/* Building Info */}
          {request.building && (
            <div className="bg-white dark:bg-[var(--admin-surface)] rounded-xl border border-gray-200 dark:border-[var(--admin-border)] p-5">
              <h2 className="text-base font-semibold text-navy dark:text-[var(--admin-text)] mb-3">
                {t('detail.buildingInfo')}
              </h2>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center">
                  <Building2 size={16} className="text-navy dark:text-[var(--admin-text)]" />
                </div>
                <div>
                  <p className="font-medium text-navy dark:text-[var(--admin-text)]">
                    {isArabic ? request.building.neighborhood_ar : request.building.neighborhood_en}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)]">
                    {isArabic ? request.building.city_ar : request.building.city_en}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Reject confirmation */}
      <ConfirmDialog
        isOpen={showRejectConfirm}
        onClose={() => setShowRejectConfirm(false)}
        onConfirm={handleReject}
        title={t('pipeline.actions.reject')}
        description={t('rejectConfirm.description')}
        confirmLabel={t('pipeline.actions.reject')}
        cancelLabel={t('deleteConfirm.cancel')}
        variant="danger"
        loading={actionLoading}
      />

      {/* Cancel confirmation */}
      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
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

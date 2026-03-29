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
import { toWhatsAppUrl } from '@/lib/utils';

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
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  requester_name: string | null;
  requester_phone: string | null;
  room_number: string | null;
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
      const res = await fetch('/api/maintenance-requests/staff?role=maintenance_staff');
      if (res.ok) {
        const staff = await res.json();
        setAssignStaff(staff);
        // If no maintenance_staff found, fetch all staff as fallback
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
  const handleCancel = () => {
    setShowCancelConfirm(false);
    updateRequest({ status: 'cancelled' });
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

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          {isArabic ? 'طلب الصيانة غير موجود' : 'Maintenance request not found'}
        </p>
      </div>
    );
  }

  const isTerminal = request.status === 'completed' || request.status === 'cancelled';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin/maintenance')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-navy">{t('detail.title')}</h1>
          <p className="text-sm text-gray-500">
            {t('detail.createdAt')}: {formatDate(request.created_at)}
          </p>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <MaintenancePipelineStepper
        status={request.status}
        cancelledAtStep={
          request.status === 'cancelled'
            ? notes.find(n => n.note.includes('\u2192 cancelled'))?.note.match(/Status changed: (\w+) \u2192/)?.[1]
            : undefined
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Requester info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-navy mb-4">
              {t('detail.requesterInfo')}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <User size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('table.requester')}</p>
                  <p className="font-medium text-navy">
                    {request.requester_name || (isArabic ? 'غير محدد' : 'Not specified')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Phone size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{isArabic ? 'الجوال' : 'Phone'}</p>
                  <p className="font-medium text-navy" dir="ltr">
                    {request.requester_phone || (isArabic ? 'غير محدد' : 'Not specified')}
                  </p>
                </div>
              </div>
              {request.room_number && (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                    <DoorOpen size={16} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('detail.roomNumber')}</p>
                    <p className="font-medium text-navy">{request.room_number}</p>
                  </div>
                </div>
              )}
            </div>

            {request.requester_phone && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                <a
                  href={`tel:${request.requester_phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-navy mb-3">
              {t('detail.issueDetails')}
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('table.title')}</p>
                <p className="font-medium text-navy">{request.title}</p>
              </div>
              <div className="flex gap-2">
                <StatusBadge label={t(`category.${request.category}`)} variant="info" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{isArabic ? 'الوصف' : 'Description'}</p>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {request.description || t('detail.noDescription')}
                </p>
              </div>
            </div>
          </div>

          {/* Photos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-navy">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-navy font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
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
                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-coral transition-colors group"
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
                <ImageIcon size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">{t('detail.noPhotos')}</p>
              </div>
            )}
          </div>

          {/* Resolution Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-navy mb-3">
              {t('detail.resolutionNotes')}
            </h2>
            <textarea
              value={editResolutionNotes}
              onChange={(e) => setEditResolutionNotes(e.target.value)}
              placeholder={t('detail.resolutionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral resize-none"
            />
            <button
              onClick={handleSaveResolutionNotes}
              disabled={savingNotes}
              className="mt-2 px-4 py-1.5 bg-gray-100 text-navy text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {savingNotes ? t('detail.saving') : t('detail.save')}
            </button>
          </div>

          {/* Notes section */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-navy mb-4">
              {t('notes.title')}
            </h2>

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

            {(() => {
              const userNotes = notes.filter(n => !n.note.startsWith('[system]'));
              return userNotes.length === 0 ? (
                <div className="text-center py-6">
                  <StickyNote size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">{t('notes.empty')}</p>
                  <p className="text-xs text-gray-300 mt-1">{t('notes.emptyDescription')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userNotes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg p-3 border bg-gray-50 border-gray-100"
                    >
                      <p className="text-sm whitespace-pre-wrap text-gray-700">
                        {note.note}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span className="font-medium">{note.author?.full_name}</span>
                        <span>&middot;</span>
                        <span>{formatDate(note.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Activity Log section */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-navy mb-4 flex items-center gap-2">
              <History size={18} />
              {t('activityLog.title')}
            </h2>

            {(() => {
              const systemNotes = notes.filter(n => n.note.startsWith('[system]'));
              return (
                <div className="space-y-3">
                  {/* Completion event */}
                  {request.completed_at && (
                    <div className="rounded-lg p-3 border bg-green-50/50 border-green-100">
                      <p className="text-sm text-green-700 italic flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-green-500" />
                        {t('activityLog.completed')}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span>{formatDate(request.completed_at)}</span>
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
                        className="rounded-lg p-3 border bg-blue-50/50 border-blue-100"
                      >
                        <p className="text-sm whitespace-pre-wrap text-blue-700 italic">
                          {displayText}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                          <span className="font-medium">{note.author?.full_name || t('notes.system')}</span>
                          <span>&middot;</span>
                          <span>{formatDate(note.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Creation event — always shown at the bottom (oldest) */}
                  <div className="rounded-lg p-3 border bg-gray-50 border-gray-200">
                    <p className="text-sm text-gray-600 italic flex items-center gap-1.5">
                      <Clock size={14} className="text-gray-400" />
                      {t('activityLog.created')}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span>{formatDate(request.created_at)}</span>
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-navy mb-4">
              {t('detail.assignment')}
            </h2>

            <div className="space-y-4">
              {/* Status + Priority badges */}
              <div className="flex gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">{t('table.status')}</p>
                  <StatusBadge
                    label={t(`status.${request.status}`)}
                    variant={getMaintenanceStatusVariant(request.status)}
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">{t('table.priority')}</p>
                  <StatusBadge
                    label={t(`priority.${request.priority}`)}
                    variant={getMaintenancePriorityVariant(request.priority)}
                  />
                </div>
              </div>

              {/* Assigned to */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">{t('detail.assignedTo')}</p>
                <p className="text-sm font-medium text-navy">
                  {request.assigned_staff?.full_name || (
                    <span className="text-gray-400">{t('table.unassigned')}</span>
                  )}
                </p>
              </div>

              {/* Assign & Review form (for submitted status) */}
              {showAssignForm && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-3">
                  {/* Priority */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5 font-medium">{t('pipeline.setPriority')}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MAINTENANCE_PRIORITIES.map((p) => (
                        <button
                          key={p}
                          onClick={() => setSelectedPriority(p)}
                          className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            selectedPriority === p
                              ? 'border-coral bg-coral text-white'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {t(`priority.${p}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Staff */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5 font-medium">{t('pipeline.selectTechnician')}</p>
                    <select
                      value={selectedStaff}
                      onChange={(e) => setSelectedStaff(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral/50 focus:border-coral bg-white"
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
                      className="px-3 py-2 text-sm text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
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

                  {/* Cancel button */}
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    <XCircle size={14} />
                    {t('pipeline.actions.cancel')}
                  </button>
                </>
              )}

              {/* Reopen */}
              {request.status === 'cancelled' && (
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

          {/* Building Info */}
          {request.building && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-navy mb-3">
                {t('detail.buildingInfo')}
              </h2>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center">
                  <Building2 size={16} className="text-navy" />
                </div>
                <div>
                  <p className="font-medium text-navy">
                    {isArabic ? request.building.neighborhood_ar : request.building.neighborhood_en}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isArabic ? request.building.city_ar : request.building.city_en}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

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

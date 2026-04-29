'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  FileText,
  FileImage,
  Upload,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';

interface Props {
  residentId: string;
  documents: string[];
  canManage: boolean;
  onDocumentsChange: (next: string[]) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // mirrors the API constant
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

// Path layout: `<resident_uuid>/<uuid>__<slug>.<ext>` — the slug after the
// double-underscore is the original filename slugified by the upload API.
function displayName(path: string): string {
  const filename = path.split('/').pop() ?? path;
  const sep = filename.indexOf('__');
  const stem = sep >= 0 ? filename.slice(sep + 2) : filename;
  return stem.replace(/-/g, ' ');
}

function fileExtension(path: string): string {
  const m = /\.([^.]+)$/.exec(path);
  return m ? m[1].toLowerCase() : '';
}

function isImageDoc(path: string): boolean {
  const ext = fileExtension(path);
  return ext === 'png' || ext === 'jpg' || ext === 'jpeg';
}

export default function ResidentDocumentsManager({
  residentId,
  documents,
  canManage,
  onDocumentsChange,
}: Props) {
  const t = useTranslations('admin.residents');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [openingPath, setOpeningPath] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onPickClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      // Upload sequentially so we can stream progress and surface per-file
      // errors without one bad file aborting the rest.
      for (const file of list) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(t('documents.toast.invalidFileType'));
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(t('documents.toast.fileTooLarge'));
          continue;
        }
        setUploading(true);
        try {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('residentId', residentId);
          const res = await fetch('/api/uploads/contract', {
            method: 'POST',
            body: fd,
          });
          if (!res.ok) {
            const json = (await res.json().catch(() => ({}))) as { error?: string };
            const code = json.error;
            const map: Record<string, string> = {
              invalidFileType: t('documents.toast.invalidFileType'),
              fileTooLarge: t('documents.toast.fileTooLarge'),
              tooManyDocuments: t('documents.toast.tooManyDocuments'),
            };
            toast.error(code && map[code] ? map[code] : t('documents.toast.uploadError'));
            continue;
          }
          const json = (await res.json()) as { path: string };
          onDocumentsChange([...documents, json.path]);
          toast.success(t('documents.toast.uploadSuccess'));
        } catch (err) {
          console.error('Document upload failed:', err);
          toast.error(t('documents.toast.uploadError'));
        } finally {
          setUploading(false);
        }
      }
    },
    [residentId, documents, onDocumentsChange, t]
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
      e.target.value = '';
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  async function handleOpen(path: string) {
    setOpeningPath(path);
    try {
      const res = await fetch(
        `/api/admin/residents/${residentId}/documents/sign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        }
      );
      if (!res.ok) {
        toast.error(t('documents.toast.openError'));
        return;
      }
      const json = (await res.json()) as { url: string };
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Sign URL failed:', err);
      toast.error(t('documents.toast.openError'));
    } finally {
      setOpeningPath(null);
    }
  }

  async function handleDelete() {
    const path = confirmDelete;
    if (!path) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/residents/${residentId}/documents?path=${encodeURIComponent(path)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        toast.error(t('documents.toast.deleteError'));
        return;
      }
      onDocumentsChange(documents.filter((p) => p !== path));
      toast.success(t('documents.toast.deleteSuccess'));
      setConfirmDelete(null);
    } catch (err) {
      console.error('Document delete failed:', err);
      toast.error(t('documents.toast.deleteError'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      {documents.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{t('detail.noDocuments')}</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((path) => {
            const opening = openingPath === path;
            const Icon = isImageDoc(path) ? FileImage : FileText;
            return (
              <li
                key={path}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors group"
              >
                <Icon
                  size={14}
                  className="text-gray-400 flex-shrink-0"
                />
                <button
                  type="button"
                  onClick={() => handleOpen(path)}
                  disabled={opening}
                  title={displayName(path)}
                  className="flex-1 min-w-0 text-start text-sm text-coral hover:text-coral/80 font-medium truncate"
                >
                  {displayName(path)}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpen(path)}
                  disabled={opening}
                  className="p-1 text-gray-400 hover:text-coral transition-colors flex-shrink-0"
                  aria-label={t('documents.openLabel')}
                >
                  {opening ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(path)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label={t('documents.deleteLabel')}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            'mt-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors',
            dragActive
              ? 'border-coral bg-coral/5'
              : 'border-gray-200 bg-white hover:border-coral/50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            multiple
            onChange={onChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={onPickClick}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-coral hover:text-coral/80 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {uploading
              ? t('documents.uploadingLabel')
              : t('documents.uploadLabel')}
          </button>
          <p className="text-xs text-gray-400 mt-1.5">
            {t('documents.dropHint')}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {t('documents.constraintsHint')}
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-gray-400">
        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
        <p>{t('documents.privacyHint')}</p>
      </div>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title={t('documents.deleteConfirm.title')}
        description={t('documents.deleteConfirm.description')}
        confirmLabel={t('documents.deleteConfirm.confirm')}
        cancelLabel={t('documents.deleteConfirm.cancel')}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

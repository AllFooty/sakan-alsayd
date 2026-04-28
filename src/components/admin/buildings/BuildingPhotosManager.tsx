'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  ImageIcon,
  Plus,
  Loader2,
  Star,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGES = 20;

interface BuildingPhotosManagerProps {
  buildingId: string;
  coverImage: string | null;
  images: string[];
  onChange: (coverImage: string | null, images: string[]) => void;
  // Read-only mode: hides upload + per-photo actions while still rendering
  // the gallery. Used when the building is soft-deleted (every PATCH would
  // 409 anyway) so users don't trigger storage/DB drift by clicking.
  disabled?: boolean;
}

type BusyKind = 'uploading' | 'reorder' | 'cover' | 'delete' | null;

export default function BuildingPhotosManager({
  buildingId,
  coverImage,
  images,
  onChange,
  disabled = false,
}: BuildingPhotosManagerProps) {
  const t = useTranslations('admin.buildings.photos');
  const tToast = useTranslations('admin.buildings.toast');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const sortedImages = orderWithCoverFirst(images, coverImage);
  const canAddMore = images.length < MAX_IMAGES;

  async function uploadFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t('errors.invalidType'));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('errors.tooLarge'));
      return;
    }
    if (!canAddMore) {
      toast.error(t('errors.tooMany', { max: MAX_IMAGES }));
      return;
    }

    setBusy('uploading');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('buildingId', buildingId);
      const upRes = await fetch('/api/uploads/building-photo', {
        method: 'POST',
        body: fd,
      });
      if (!upRes.ok) {
        const json = await upRes.json().catch(() => ({}));
        const code = json?.error;
        if (code === 'invalidFileType') toast.error(t('errors.invalidType'));
        else if (code === 'fileTooLarge') toast.error(t('errors.tooLarge'));
        else toast.error(t('errors.uploadFailed'));
        return;
      }
      const { path, url } = (await upRes.json()) as { path: string; url: string };

      const nextImages = [...images, url];
      const nextCover = coverImage ?? url;
      const ok = await patchBuilding({ images: nextImages, cover_image: nextCover });
      if (ok) {
        onChange(nextCover, nextImages);
        toast.success(t('toast.uploaded'));
      } else if (path) {
        await fetch(`/api/uploads/building-photo?path=${encodeURIComponent(path)}`, {
          method: 'DELETE',
        }).catch(() => null);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error(t('errors.uploadFailed'));
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function patchBuilding(updates: {
    images?: string[];
    cover_image?: string | null;
  }): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/buildings/${buildingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        toast.error(tToast('genericError'));
        return false;
      }
      return true;
    } catch (err) {
      console.error('PATCH failed:', err);
      toast.error(tToast('genericError'));
      return false;
    }
  }

  async function handleSetCover(url: string) {
    if (coverImage === url) return;
    setBusy('cover');
    setBusyUrl(url);
    const ok = await patchBuilding({ cover_image: url });
    if (ok) {
      onChange(url, images);
      toast.success(t('toast.coverSet'));
    }
    setBusy(null);
    setBusyUrl(null);
  }

  async function handleMove(url: string, direction: -1 | 1) {
    const idx = images.indexOf(url);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= images.length) return;
    const next = images.slice();
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    setBusy('reorder');
    setBusyUrl(url);
    const ok = await patchBuilding({ images: next });
    if (ok) onChange(coverImage, next);
    setBusy(null);
    setBusyUrl(null);
  }

  async function handleDelete(url: string) {
    setBusy('delete');
    setBusyUrl(url);
    try {
      const path = parsePathFromUrl(url);
      // Storage delete is best-effort: if it fails, we still want to detach
      // the URL from the building so it doesn't keep showing a broken link.
      if (path) {
        await fetch(`/api/uploads/building-photo?path=${encodeURIComponent(path)}`, {
          method: 'DELETE',
        }).catch(() => null);
      }
      const nextImages = images.filter((i) => i !== url);
      const nextCover = coverImage === url ? nextImages[0] ?? null : coverImage;
      const ok = await patchBuilding({
        images: nextImages,
        ...(coverImage === url ? { cover_image: nextCover } : {}),
      });
      if (ok) {
        onChange(nextCover, nextImages);
        toast.success(t('toast.deleted'));
      }
    } finally {
      setBusy(null);
      setBusyUrl(null);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
          <ImageIcon size={16} className="text-gray-400" />
          {t('title')}
          <span className="text-xs text-gray-400 font-normal tabular-nums">
            ({images.length}/{MAX_IMAGES})
          </span>
        </h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />
        {!disabled && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy === 'uploading' || !canAddMore}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-coral text-white font-medium rounded-lg hover:bg-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {busy === 'uploading' ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t('uploading')}
            </>
          ) : (
            <>
              <Plus size={14} />
              {t('add')}
            </>
          )}
        </button>
        )}
      </div>

      {/* Drag-drop empty state */}
      {sortedImages.length === 0 ? (
        disabled ? (
          <div className="flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed border-gray-200 py-10">
            <ImageIcon size={28} className="text-gray-300" />
            <p className="mt-3 text-sm font-medium text-navy">{t('emptyTitle')}</p>
            <p className="mt-1 text-xs text-gray-500">{t('disabledEmptyHint')}</p>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed py-10 cursor-pointer transition-colors ${
              dragOver
                ? 'border-coral bg-coral/5'
                : 'border-gray-200 hover:border-coral/50 hover:bg-gray-50'
            }`}
          >
            <Upload size={28} className="text-gray-300" />
            <p className="mt-3 text-sm font-medium text-navy">{t('emptyTitle')}</p>
            <p className="mt-1 text-xs text-gray-500">{t('emptyHint')}</p>
          </div>
        )
      ) : (
        <div
          onDragOver={(e) => {
            if (disabled) return;
            e.preventDefault();
            if (!busy && canAddMore) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={disabled ? undefined : handleDrop}
          className={`grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg ${
            dragOver ? 'ring-2 ring-coral/40 ring-offset-2' : ''
          }`}
        >
          {sortedImages.map((url) => {
            const isCover = url === coverImage;
            const photoBusy = busyUrl === url;
            const idx = images.indexOf(url);
            return (
              <div
                key={url}
                className={`relative group aspect-square rounded-lg overflow-hidden border ${
                  isCover
                    ? 'border-coral ring-2 ring-coral/30'
                    : 'border-gray-200 hover:border-coral/50'
                } transition-all`}
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
                  className="object-cover"
                />
                {isCover && (
                  <span className="absolute top-1.5 start-1.5 z-10 text-[11px] font-medium bg-coral text-white px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Star size={10} fill="currentColor" />
                    {t('coverBadge')}
                  </span>
                )}
                {/* Action overlay — hidden in read-only mode */}
                {!disabled && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 focus-within:bg-black/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    {!isCover && (
                      <ActionButton
                        onClick={() => handleSetCover(url)}
                        disabled={!!busy}
                        label={t('actions.setCover')}
                        busy={photoBusy && busy === 'cover'}
                      >
                        <Star size={14} />
                      </ActionButton>
                    )}
                    <ActionButton
                      onClick={() => handleMove(url, -1)}
                      disabled={!!busy || idx === 0}
                      label={t('actions.moveUp')}
                      busy={photoBusy && busy === 'reorder'}
                    >
                      <ChevronUp size={14} />
                    </ActionButton>
                    <ActionButton
                      onClick={() => handleMove(url, 1)}
                      disabled={!!busy || idx === images.length - 1}
                      label={t('actions.moveDown')}
                      busy={photoBusy && busy === 'reorder'}
                    >
                      <ChevronDown size={14} />
                    </ActionButton>
                    <ActionButton
                      onClick={() => handleDelete(url)}
                      disabled={!!busy}
                      label={t('actions.delete')}
                      busy={photoBusy && busy === 'delete'}
                      variant="danger"
                    >
                      <Trash2 size={14} />
                    </ActionButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sortedImages.length > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          {disabled ? t('disabledHelpText') : t('helpText')}
        </p>
      )}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  label,
  busy,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  busy?: boolean;
  variant?: 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-md backdrop-blur-sm shadow ${
        variant === 'danger'
          ? 'bg-white/90 text-red-600 hover:bg-red-600 hover:text-white'
          : 'bg-white/90 text-navy hover:bg-white'
      } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  );
}

function orderWithCoverFirst(images: string[], cover: string | null): string[] {
  if (!cover) return images;
  const idx = images.indexOf(cover);
  if (idx <= 0) return images;
  return [cover, ...images.slice(0, idx), ...images.slice(idx + 1)];
}

function parsePathFromUrl(url: string): string | null {
  // public URL shape: <project>.supabase.co/storage/v1/object/public/buildings-photos/<buildingId>/<file>
  const m = url.match(/\/storage\/v1\/object\/public\/buildings-photos\/(.+)$/);
  return m ? m[1] : null;
}

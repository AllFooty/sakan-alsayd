import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { isRateLimited } from '@/lib/rate-limit';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DOCS_PER_RESIDENT = 20;
const MAX_FILENAME_BASE = 80;

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
  };
  return map[mimeType] ?? 'bin';
}

// Slug an arbitrary filename: keep alphanumerics + dashes/underscores; collapse
// runs of unsafe chars to a single dash; strip the extension first so we can
// reattach it cleanly. Cap to 80 chars to keep storage paths sane.
function slugFilename(name: string): string {
  const stem = name.replace(/\.[^./]+$/, '');
  const slug = stem
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_FILENAME_BASE);
  return slug || 'document';
}

// POST /api/uploads/contract — multipart upload with `file` and `residentId`.
// Path layout: `<resident_id>/<uuid>__<slug>.<ext>` so the storage RLS can
// extract resident_id from the first path segment, and the UI can recover the
// original filename from the slug for display.
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (await isRateLimited(`upload-contract:${ip}`, 20, 60_000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const auth = await authenticateApiRequest('branch_manager', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const formData = await request.formData();
    const file = formData.get('file');
    const residentId = formData.get('residentId');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (typeof residentId !== 'string' || !UUID_RE.test(residentId)) {
      return NextResponse.json({ error: 'invalidResidentId' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'invalidFileType' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'fileTooLarge' }, { status: 400 });
    }

    // Verify resident exists. Storage RLS will reject upload for unauthorized
    // staff anyway, but a quick lookup gives a cleaner 404 for missing
    // residents and lets us read the current `documents` array.
    const { data: resident, error: residentErr } = await supabase
      .from('residents')
      .select('id, documents')
      .eq('id', residentId)
      .maybeSingle<{ id: string; documents: string[] | null }>();
    if (residentErr) {
      console.error('Contract upload: resident fetch failed:', residentErr);
      return NextResponse.json({ error: 'uploadFailed' }, { status: 500 });
    }
    if (!resident) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const docs = resident.documents ?? [];
    if (docs.length >= MAX_DOCS_PER_RESIDENT) {
      return NextResponse.json({ error: 'tooManyDocuments' }, { status: 409 });
    }

    const ext = getExtension(file.type);
    const slug = slugFilename(file.name);
    const fileName = `${randomUUID()}__${slug}.${ext}`;
    const storagePath = `${residentId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      // RLS or bucket-level rejection surfaces here. Forbidden surfaces as
      // a generic uploadFailed; we don't differentiate to avoid leaking
      // who's allowed to upload for which residents.
      console.error('Contract upload error:', uploadError);
      return NextResponse.json({ error: 'uploadFailed' }, { status: 500 });
    }

    // Append the new path to residents.documents. If this fails we leave the
    // object orphaned in storage; that's acceptable (we'd rather fail closed
    // than have a phantom document referenced from the resident row).
    const newDocs = [...docs, storagePath];
    const { error: updErr } = await supabase
      .from('residents')
      .update({ documents: newDocs })
      .eq('id', residentId);
    if (updErr) {
      console.error('Contract upload: residents.documents update failed:', updErr);
      // Best-effort cleanup so we don't leave the orphan around.
      void supabase.storage.from('contracts').remove([storagePath]);
      return NextResponse.json({ error: 'uploadFailed' }, { status: 500 });
    }

    return NextResponse.json({
      path: storagePath,
      filename: file.name,
      size: file.size,
      content_type: file.type,
    });
  } catch (error) {
    console.error('Contract upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

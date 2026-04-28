import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { getAssignedBuildingIds, hasAdminAccess } from '@/lib/auth/guards';
import { isRateLimited } from '@/lib/rate-limit';
import { revalidatePublicBuildings } from '@/lib/buildings/public';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[mimeType] || 'jpg';
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (await isRateLimited(`upload-building:${ip}`, 20, 60_000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const auth = await authenticateApiRequest('branch_manager');
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    const formData = await request.formData();
    const file = formData.get('file');
    const buildingId = formData.get('buildingId');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (typeof buildingId !== 'string' || !UUID_RE.test(buildingId)) {
      return NextResponse.json({ error: 'invalidBuildingId' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'invalidFileType' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'fileTooLarge' }, { status: 400 });
    }

    if (!hasAdminAccess(profile.role)) {
      const assigned = await getAssignedBuildingIds(profile.id);
      if (!assigned.includes(buildingId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    // Refuse uploads to inactive buildings — soft-deleted means read-only.
    const { data: bldg, error: bldgErr } = await supabase
      .from('buildings')
      .select('id, is_active')
      .eq('id', buildingId)
      .maybeSingle<{ id: string; is_active: boolean }>();
    if (bldgErr) {
      console.error('Building lookup failed:', bldgErr);
      return NextResponse.json({ error: 'uploadFailed' }, { status: 500 });
    }
    if (!bldg) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!bldg.is_active) {
      return NextResponse.json({ error: 'buildingInactive' }, { status: 409 });
    }

    const ext = getExtension(file.type);
    const fileName = `${randomUUID()}.${ext}`;
    const storagePath = `${buildingId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('buildings-photos')
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Building photo upload error:', uploadError);
      return NextResponse.json({ error: 'uploadFailed' }, { status: 500 });
    }

    const { data: publicData } = supabase.storage
      .from('buildings-photos')
      .getPublicUrl(storagePath);

    revalidatePublicBuildings();

    return NextResponse.json({ path: storagePath, url: publicData.publicUrl });
  } catch (error) {
    console.error('Upload building photo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Strict UUID/UUID/.ext shape — both segments are dashed UUIDs (the prefix is
// the building UUID; the filename is randomUUID() from the upload handler).
const PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest('branch_manager');
    if (isAuthError(auth)) return auth;
    const { profile, supabase } = auth;

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    if (!path || !PATH_RE.test(path)) {
      return NextResponse.json({ error: 'invalidPath' }, { status: 400 });
    }

    const buildingId = path.split('/')[0];
    if (!UUID_RE.test(buildingId)) {
      return NextResponse.json({ error: 'invalidPath' }, { status: 400 });
    }

    if (!hasAdminAccess(profile.role)) {
      const assigned = await getAssignedBuildingIds(profile.id);
      if (!assigned.includes(buildingId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    const { error } = await supabase.storage
      .from('buildings-photos')
      .remove([path]);
    if (error) {
      console.error('Building photo delete error:', error);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }

    revalidatePublicBuildings();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete building photo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

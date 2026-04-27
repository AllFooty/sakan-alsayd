import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { randomUUID } from 'crypto';
import { isRateLimited } from '@/lib/rate-limit';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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
    if (await isRateLimited(`upload:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const requestId = formData.get('requestId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    let supabase;

    if (requestId) {
      // Staff uploading to existing request — require authentication
      const auth = await authenticateApiRequest(
        'branch_manager',
        'maintenance_staff',
        'maintenance_manager',
        'supervision_staff'
      );
      if (isAuthError(auth)) return auth;
      supabase = auth.supabase;
    } else {
      // Public upload from maintenance modal — use admin client
      supabase = createAdminClient();
    }

    const ext = getExtension(file.type);
    const folder = requestId || 'temp';
    const fileName = `${randomUUID()}.${ext}`;
    const storagePath = `${folder}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('maintenance-photos')
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    return NextResponse.json({ path: storagePath });
  } catch (error) {
    console.error('Upload maintenance photo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

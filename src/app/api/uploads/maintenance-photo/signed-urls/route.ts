import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';
import { isRateLimited } from '@/lib/rate-limit';

const PHOTO_PATH_RE = /^(temp|[0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const MAX_PATHS = 20;

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (await isRateLimited(`signed-url:${ip}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { paths } = await request.json();

    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ urls: [] });
    }

    if (paths.length > MAX_PATHS) {
      return NextResponse.json({ error: `Too many paths (max ${MAX_PATHS})` }, { status: 400 });
    }

    if (!paths.every((p) => typeof p === 'string' && PHOTO_PATH_RE.test(p))) {
      return NextResponse.json({ error: 'Invalid path format' }, { status: 400 });
    }

    const urls = await Promise.all(
      paths.map(async (path: string) => {
        const { data } = await supabase.storage
          .from('maintenance-photos')
          .createSignedUrl(path, 3600);

        return {
          path,
          url: data?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({ urls: urls.filter((u) => u.url !== null) });
  } catch (error) {
    console.error('Signed URLs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

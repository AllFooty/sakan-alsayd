import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest();
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const { paths } = await request.json();

    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ urls: [] });
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

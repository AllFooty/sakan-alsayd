import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL = 5 * 60; // 5 minutes — long enough to click+open, short enough to limit blast radius.

// POST /api/admin/residents/[id]/documents/sign
// Body: { path: string }
// Returns: { url, expires_at }
//
// Generates a short-lived signed download URL for a single document path.
// Storage RLS gates which staff can call this — unauthorized callers get a
// generic uploadFailed-style error to avoid leaking which paths exist.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: residentId } = await params;
    if (!UUID_RE.test(residentId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const auth = await authenticateApiRequest('branch_manager', 'supervision_staff');
    if (isAuthError(auth)) return auth;
    const { supabase } = auth;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'invalidBody' }, { status: 400 });
    }
    const path = (body as Record<string, unknown>).path;
    if (typeof path !== 'string' || !path) {
      return NextResponse.json({ error: 'invalidPath' }, { status: 400 });
    }

    // Path must start with the resident's UUID — defense in depth so a caller
    // can't request a signed URL for somebody else's document by handing us
    // a path under a different resident.
    const prefix = `${residentId}/`;
    if (!path.startsWith(prefix)) {
      return NextResponse.json({ error: 'invalidPath' }, { status: 400 });
    }

    // Confirm the path is in the resident's documents array (server-side
    // truth — storage RLS will also gate, but this prevents probing for
    // arbitrary paths under the resident's prefix).
    const { data: resident, error: residentErr } = await supabase
      .from('residents')
      .select('documents')
      .eq('id', residentId)
      .maybeSingle<{ documents: string[] | null }>();
    if (residentErr) {
      console.error('Contract sign: resident fetch failed:', residentErr);
      return NextResponse.json({ error: 'signFailed' }, { status: 500 });
    }
    if (!resident) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const docs = resident.documents ?? [];
    if (!docs.includes(path)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data, error } = await supabase.storage
      .from('contracts')
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (error || !data) {
      // Storage RLS rejection lands here for unauthorized staff. Surface as
      // 404 to avoid leaking existence.
      console.error('Contract sign: createSignedUrl failed:', error);
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      url: data.signedUrl,
      expires_in: SIGNED_URL_TTL,
    });
  } catch (error) {
    console.error('Contract sign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

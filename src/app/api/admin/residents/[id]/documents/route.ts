import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE /api/admin/residents/[id]/documents?path=<storagePath>
//
// Removes a document from BOTH residents.documents and the contracts bucket.
// Order: bucket first, then row update. If the row update fails after a
// successful bucket delete, the resident row temporarily references a missing
// object — fixed on next upload/edit cycle, and the documents list will
// gracefully render the orphan as missing.
export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    if (!path) {
      return NextResponse.json({ error: 'invalidPath' }, { status: 400 });
    }
    const prefix = `${residentId}/`;
    if (!path.startsWith(prefix)) {
      return NextResponse.json({ error: 'invalidPath' }, { status: 400 });
    }

    const { data: resident, error: residentErr } = await supabase
      .from('residents')
      .select('documents')
      .eq('id', residentId)
      .maybeSingle<{ documents: string[] | null }>();
    if (residentErr) {
      console.error('Contract delete: resident fetch failed:', residentErr);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }
    if (!resident) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const docs = resident.documents ?? [];
    if (!docs.includes(path)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { error: storageErr } = await supabase.storage
      .from('contracts')
      .remove([path]);
    if (storageErr) {
      // 404-style storage errors are tolerable — the row is the source of
      // truth and we want to be able to clean up dangling references.
      console.warn('Contract delete: storage remove warning:', storageErr);
    }

    const newDocs = docs.filter((p) => p !== path);
    const { error: updErr } = await supabase
      .from('residents')
      .update({ documents: newDocs })
      .eq('id', residentId);
    if (updErr) {
      console.error('Contract delete: residents.documents update failed:', updErr);
      return NextResponse.json({ error: 'deleteFailed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Contract delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

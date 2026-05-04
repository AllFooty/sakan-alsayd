import { NextResponse } from 'next/server';
import { authenticateApiRequest, isAuthError } from '@/lib/auth/api-guards';

// Returns the latest activity log entries (resident lifecycle, booking
// conversions, booking + maintenance status transitions).
export interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_name: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
}

const LIMIT = 10;

export async function GET() {
  const auth = await authenticateApiRequest('branch_manager');
  if (isAuthError(auth)) return auth;

  const { supabase } = auth;

  // Pull recent rows + actor name in one round-trip via the FK relationship
  // declared in 001_schema.sql (activity_log.user_id → staff_profiles.id).
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action, entity_type, entity_id, details, created_at, staff_profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items: ActivityItem[] = (data ?? []).map((row) => {
    // Supabase returns the joined row as an object (or array if the FK
    // resolves ambiguously); normalize to a single full_name | null.
    const sp = row.staff_profiles as
      | { full_name: string | null }
      | { full_name: string | null }[]
      | null;
    const actorRow = Array.isArray(sp) ? sp[0] ?? null : sp;
    return {
      id: row.id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      actor_name: actorRow?.full_name ?? null,
      created_at: row.created_at,
      details: (row.details as Record<string, unknown> | null) ?? null,
    };
  });

  const response = NextResponse.json({ items });
  // Activity is the freshest signal on the dashboard — short cache so a new
  // event surfaces quickly, but still benefits from SWR.
  response.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
  return response;
}

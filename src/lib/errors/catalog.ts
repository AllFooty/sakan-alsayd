// Stable error kinds for user-facing submit failures. Each maps 1:1 to a
// translation key under `errors.submitFailure.*` so callers stay decoupled
// from the exact wording.
export type SubmitErrorKind =
  | 'network'     // fetch couldn't reach the server
  | 'validation'  // 400/422 from the API (caller may also surface field-level errors)
  | 'conflict'    // 409 — duplicate, slug taken, etc.
  | 'permission'  // 401/403 — auth/RBAC failure
  | 'server'      // 5xx
  | 'unknown';    // anything we can't classify

interface ClassifyInput {
  res?: Response;
  err?: unknown;
}

// Normalize a Response/Error/anything into a stable kind. Defensive against
// missing fields — anything we can't recognize falls through to 'unknown'.
export function classifyError({ res, err }: ClassifyInput): SubmitErrorKind {
  // Fetch network failure (DNS, offline, CORS preflight failure, etc.) shows
  // up as TypeError client-side — distinguish it from server errors so we
  // can suggest "check your connection" rather than "team has been notified."
  if (err instanceof TypeError) return 'network';

  const status = res?.status;
  if (typeof status !== 'number') return 'unknown';

  if (status === 400 || status === 422) return 'validation';
  if (status === 401 || status === 403) return 'permission';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'server';

  return 'unknown';
}

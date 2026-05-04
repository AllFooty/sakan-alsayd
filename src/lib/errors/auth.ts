// Map Supabase auth-js errors to user-facing kinds. Each kind corresponds 1:1
// to a translation under `admin.login.errors.*`.
//
// We prefer `error.code` (stable contract from @supabase/auth-js — see
// node_modules/@supabase/auth-js/dist/main/lib/error-codes.d.ts). When the
// SDK is older than the server, code may be missing — in that case we fall
// back to substring-matching the message. Anything we can't classify maps
// to `unknown`, which surfaces a friendly fallback rather than the raw text.

export type AuthErrorKind =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'invalidOtp'
  | 'rateLimited'
  | 'userNotFound'
  | 'emailInvalid'
  | 'network'
  | 'unknown';

interface MaybeAuthError {
  code?: string;
  status?: number;
  message?: string;
}

export function classifyAuthError(err: unknown): AuthErrorKind {
  // Fetch-level network failures bubble up as TypeError (e.g. user offline,
  // CORS preflight blocked, DNS failure).
  if (err instanceof TypeError) return 'network';

  const e = err as MaybeAuthError;

  // Modern path: error.code is the stable contract.
  switch (e.code) {
    case 'invalid_credentials':
      return 'invalidCredentials';
    case 'email_not_confirmed':
      return 'emailNotConfirmed';
    case 'otp_expired':
      return 'invalidOtp';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
      return 'rateLimited';
    case 'user_not_found':
      return 'userNotFound';
    case 'email_address_invalid':
      return 'emailInvalid';
    case 'request_timeout':
      return 'network';
  }

  // Fallback: older SDKs / non-standard errors. Substring-match the message
  // (lowercased) for the most common phrasings. This is a defensive layer —
  // if Supabase rewords messages, we degrade to 'unknown' (still friendly).
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return 'invalidCredentials';
  }
  if (msg.includes('email not confirmed')) return 'emailNotConfirmed';
  if (msg.includes('otp') && (msg.includes('expired') || msg.includes('invalid'))) {
    return 'invalidOtp';
  }
  if (msg.includes('rate limit') || msg.includes('too many')) return 'rateLimited';
  if (msg.includes('user not found')) return 'userNotFound';

  // 4xx without a recognized code → treat as credentials error (typical for
  // a bad password attempt without an explicit code field).
  if (e.status === 400 || e.status === 401) return 'invalidCredentials';
  if (e.status === 422) return 'emailInvalid';
  if (e.status === 429) return 'rateLimited';

  return 'unknown';
}

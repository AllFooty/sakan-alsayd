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
  | 'weakPassword'
  | 'samePassword'
  | 'accountDisabled'
  | 'network'
  | 'unknown';

// Which auth call produced this error. Lets us disambiguate the status-only
// 400/401 fallback: a 400 from signInWithOtp is almost always a malformed
// email (the flow has no password to be wrong), while a 400 from
// signInWithPassword is a credentials error.
export type AuthFlow = 'password' | 'otp_send' | 'otp_verify';

interface MaybeAuthError {
  code?: string;
  status?: number;
  message?: string;
}

export function classifyAuthError(
  err: unknown,
  flow: AuthFlow = 'password'
): AuthErrorKind {
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
    case 'validation_failed':
      return 'emailInvalid';
    case 'weak_password':
      return 'weakPassword';
    case 'same_password':
      return 'samePassword';
    case 'user_banned':
      return 'accountDisabled';
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

  // 4xx without a recognized code. Disambiguate by flow:
  //   password   → bad password attempt (invalidCredentials)
  //   otp_send   → likely a malformed email (no password to be wrong)
  //   otp_verify → wrong / expired token
  if (e.status === 400 || e.status === 401) {
    if (flow === 'otp_send') return 'emailInvalid';
    if (flow === 'otp_verify') return 'invalidOtp';
    return 'invalidCredentials';
  }
  if (e.status === 422) return 'emailInvalid';
  if (e.status === 429) return 'rateLimited';

  return 'unknown';
}

/**
 * Better Auth returns errors as `{ message, code }` — never `{ error }`.
 *
 * The sign-in form used to read `data?.error`, so every failure (wrong
 * password, 429 rate limit, 500) showed the generic "Invalid email or
 * password". That made a rate-limit lockout look like a bad password,
 * so people retried and stayed locked out.
 *
 * `tests/auth-config.test.mjs` covers this.
 */
export function messageFrom(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export function signInFailure(status: number, data: unknown): string {
  const code = data && typeof data === 'object' && 'code' in data ? data.code : null;
  if (status === 429) return 'Too many sign-in attempts. Wait a few minutes and try again.';
  if (status === 403 && code === 'STUDENT_INELIGIBLE') return 'This student account cannot sign in. Contact your administrator.';
  if (status === 403) return 'Sign-in was blocked. Open the app at its configured address or contact your administrator.';
  if (status === 503 && code === 'AUTH_DATABASE_SCHEMA') {
    return 'Sign-in is unavailable because the database setup is incomplete. Contact your administrator.';
  }
  if (status >= 500) return 'Sign-in is temporarily unavailable. Try again shortly.';
  if (status === 401 || code === 'INVALID_EMAIL_OR_PASSWORD') return 'Invalid email or password.';
  return 'The sign-in request could not be processed. Check the form and try again.';
}

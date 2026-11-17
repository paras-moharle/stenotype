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

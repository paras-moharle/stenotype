/**
 * Simple in-memory rate limiter for the login endpoint.
 *
 * A sliding window keyed by client IP: more than MAX_ATTEMPTS
 * attempts inside WINDOW_MS → locked out until the oldest attempt
 * leaves the window. This is brute-force protection, not an
 * identity system — serverless instances each hold their own map,
 * which is fine for a two-account preview app.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, number[]>();

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the oldest attempt leaves the window (when !ok). */
  retryAfterSeconds: number;
};

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );

  if (recent.length >= MAX_ATTEMPTS) {
    const oldest = recent[0] ?? now;
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  attempts.set(key, recent);
  return { ok: true, retryAfterSeconds: 0 };
}

/** Clear a key's history (used after a successful login). */
export function resetRateLimit(key: string): void {
  attempts.delete(key);
}

/** Extract the client IP from proxy headers. */
export function clientIpFrom(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

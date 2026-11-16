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

// Purge keys whose attempts have all aged out so the map cannot
// grow without bound. Best-effort: on serverless each instance
// still holds its own map (fine for a two-account preview app);
// move to shared storage (DB/Redis) when multi-instance.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, stamps] of attempts) {
    const recent = stamps.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0) {
      attempts.delete(key);
    } else {
      attempts.set(key, recent);
    }
  }
}, WINDOW_MS);
if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
  cleanupTimer.unref();
}

/** Extract the client IP.
 *
 * X-Forwarded-For / X-Real-IP are only trustworthy behind a
 * configured reverse proxy. This app runs as a plain `next start`
 * with no trusted-proxy setup, so those headers are client-
 * controlled and trivially spoofable (vary XFF per request to get
 * a fresh rate-limit key each time). Until a trusted proxy is in
 * front, fall back to a single shared key — correct for a
 * two-account preview. Better Auth (Chunk 5) replaces this.
 */
export function clientIpFrom(_req: Request): string {
  return 'unknown';
}


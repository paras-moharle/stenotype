/**
 * In-memory fixed-window rate limiter.
 *
 * Better Auth only throttles /api/auth/*; the scoring endpoint needs its
 * own guard so a signed-in account cannot hammer it (each call runs an
 * O(n·m) alignment and writes a row).
 *
 * Storage is per-process. On Vercel that means per lambda instance, so it
 * is a burst guard, not a global quota — documented, not pretended.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep: number | undefined;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  if (lastSweep === undefined || now - lastSweep >= 60_000) {
    for (const [bucketKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(bucketKey);
    }
    lastSweep = now;
  }
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: bucket.resetAt - now,
    };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

/** Test helper — clears all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = undefined;
}

/** Attempt submission budget: 30 per user per 5 minutes. */
export const ATTEMPT_RATE_LIMIT = {
  limit: 30,
  windowMs: 5 * 60_000,
} as const;

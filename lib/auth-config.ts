import type { BetterAuthRateLimitOptions } from 'better-auth';

/**
 * Public self-registration is disabled.
 *
 * Accounts are created only by an admin from the admin panel
 * (`auth.api.createUser`, which bypasses this flag). Without this,
 * anyone could create a student account and read the practice content
 * for free.
 *
 * Guarded by tests/security-config.test.mjs.
 */
export const signUpPolicy = {
  disableSignUp: true,
} as const;

/**
 * Rate limiting for Better Auth.
 *
 * `storage` MUST stay `'memory'`.
 *
 * With `'database'`, Better Auth implements the counter with an
 * interactive Prisma transaction (the adapter's `incrementOne` calls
 * `db.$transaction`), and it runs on **every** auth request — including
 * `/get-session`, which fires on every page load. On serverless with a
 * small pg pool that exhausts connections and Prisma throws P2028
 * ("Unable to start a transaction in the given time"). The result:
 * session checks return 500 and sign-out silently fails, because a 500
 * response carries no Set-Cookie and the user stays logged in.
 *
 * `tests/auth-config.test.mjs` guards this — do not change it to
 * `'database'` without solving the transaction/pool problem first.
 */
export const rateLimitConfig: BetterAuthRateLimitOptions = {
  window: 60, // 60 seconds
  max: 100, // 100 requests per window per IP
  storage: 'memory',
  customRules: {
    // Never throttle these. A 429 on a session check looks exactly
    // like being logged out, and a 429 on sign-out leaves the user
    // signed in.
    '/get-session': false,
    '/sign-out': false,
  },
};

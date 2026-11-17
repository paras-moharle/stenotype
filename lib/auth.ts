import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { db } from './db';
import { rateLimitConfig } from './auth-config';

// ─────────────────────────────────────────────────────────────
// Better Auth — email/password + DB sessions + admin plugin.
//
// Your requirements, enforced here:
//  - No credential sharing → single active session. Every new
//    sign-in revokes that user's other sessions (see the
//    databaseHooks below). The cookie cache is DISABLED so a
//    revoked session is invalid immediately — no 5-minute window
//    where two devices share one account.
//  - Full admin visibility → every successful sign-in is written
//    to the LoginAttempt audit table.
//  - Lockout → the admin plugin's `banned` flag; a banned user
//    cannot sign in. Rate limiting is configured explicitly.
//  - Session lifetime → 7-day absolute, refreshed on activity.
//
// NOTE: auditing lives in databaseHooks (not the `hooks` API)
// because the `hooks` dispatcher crashes when auth is invoked
// programmatically (e.g. from server components calling
// getSession, or the seed script) without an HTTP request
// context. Failed sign-in recording needs a custom wrapper
// route — tracked for Step 6 (admin UI).
// ─────────────────────────────────────────────────────────────

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  session: {
    // 7-day absolute lifetime; expiry slides forward on activity
    // (updateAge) so an active user is not kicked mid-test.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 4,
    // Cookie cache DISABLED: with it on, get-session trusts a
    // signed cookie for up to 5 minutes without hitting the DB,
    // so banned/revoked users keep access and a second device
    // shares the account. Off = every check hits the DB.
    cookieCache: {
      enabled: false,
    },
  },

  // Rate limiting — see lib/auth-config.ts for why storage must stay
  // 'memory' and why /get-session + /sign-out are exempt.
  rateLimit: rateLimitConfig,

  advanced: {
    ipAddress: {
      // Trust X-Forwarded-For so each real client gets its own
      // rate-limit bucket (behind Vercel/proxies).
      ipAddressHeaders: ['x-forwarded-for'],
    },
  },

  plugins: [
    admin({
      // Admins are identified by the `admin` role value.
      adminRoles: ['admin'],
      defaultRole: 'student',
    }),
  ],

  databaseHooks: {
    session: {
      create: {
        async after(session) {
          // Single active session: revoke every other session for
          // this user so a shared password cannot be used from
          // two places at once. Guarded so a transient DB failure
          // never turns a successful sign-in into a 500.
          //
          // The revocation and the email lookup are independent, so
          // run them together — sign-in latency is one round-trip
          // shorter on a cold connection.
          const [, user] = await Promise.all([
            db.session
              .deleteMany({
                where: {
                  userId: session.userId,
                  id: { not: session.id },
                },
              })
              .catch(() => null),
            db.user
              .findUnique({
                where: { id: session.userId },
                select: { email: true },
              })
              .catch(() => null),
          ]);

          // Audit the successful sign-in.
          try {
            await db.loginAttempt.create({
              data: {
                email: user?.email ?? 'unknown',
                userId: session.userId,
                success: true,
                ipAddress: session.ipAddress ?? null,
                userAgent: session.userAgent ?? null,
              },
            });
          } catch {
            // Audit logging must never break sign-in.
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;


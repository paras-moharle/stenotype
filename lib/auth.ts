import { developmentOrigins, exactOrigin } from './auth-origins';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { db } from './db';
import { getStorageCapacity } from './db-capacity';
import { maintainDuringTraffic } from './db-maintenance';
import { rateLimitConfig, signUpPolicy } from './auth-config';

// The database trigger atomically replaces the prior session. The auth
// hook is exclusively for best-effort audit logging.
export const auth = betterAuth({
  baseURL: exactOrigin(process.env.BETTER_AUTH_URL),
  trustedOrigins: developmentOrigins(),
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // No public sign-up: admins create every account.
    ...signUpPolicy,
  },

  session: {
    // 7-day expiry slides forward on activity
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
      // Only Vercel's platform-provided address is used for IP buckets.
      ipAddressHeaders: process.env.VERCEL === '1' ? ['x-vercel-forwarded-for'] : [],
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
          try {
            await maintainDuringTraffic();
            if ((await getStorageCapacity()).level === 'restricted') return;
            await db.$executeRaw`
              INSERT INTO "LoginAttempt" ("id", "email", "userId", "success", "ipAddress", "userAgent")
              SELECT gen_random_uuid()::text, "email", "id", true,
                     ${session.ipAddress?.slice(0, 64) ?? null}, ${session.userAgent?.slice(0, 512) ?? null}
              FROM "user" WHERE "id" = ${session.userId}
            `;
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


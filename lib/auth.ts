import { APIError } from 'better-auth/api';
import { lockStudentAccount } from './student-account-lock';
import { signInSnapshot } from './admitted-sign-in';
import { developmentOrigins, exactOrigin } from './auth-origins';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { db } from './db';
import { getStorageCapacity } from './db-capacity';
import { rateLimitConfig, signUpPolicy } from './auth-config';

// The trigger replaces the prior session atomically. Admission below
// checks that the account still matches the credentials just verified.
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
        async before(session) {
          const snapshot = signInSnapshot.getStore();
          if (snapshot === undefined) return;
          if (!snapshot || snapshot.id !== session.userId) throw new APIError('UNAUTHORIZED', { message: 'Invalid email or password.' });
          if (snapshot.role !== 'student') return;
          const profile = await db.studentProfile.findUnique({
            where: { userId: session.userId }, select: { status: true },
          });
          if (profile?.status !== 'ACTIVE') {
            throw new APIError('FORBIDDEN', { code: 'STUDENT_INELIGIBLE', message: 'Student access is unavailable.' });
          }
        },
        async after(session) {
          const snapshot = signInSnapshot.getStore();
          if (snapshot?.role === 'student' && snapshot.id === session.userId) {
            const admitted = await db.$transaction(async tx => {
              const user = await lockStudentAccount(tx, session.userId);
              const profile = await tx.studentProfile.findUnique({
                where: { userId: session.userId }, select: { status: true },
              });
              if (user && !user.banned && user.updatedAt.getTime() === snapshot.updatedAt && profile?.status === 'ACTIVE') {
                return true;
              }
              await tx.session.deleteMany({ where: { id: session.id, userId: session.userId } });
              return false;
            });
            if (!admitted) throw new APIError('FORBIDDEN', { code: 'STUDENT_INELIGIBLE', message: 'Student access is unavailable.' });
          }

          try {
            if ((await getStorageCapacity()).level === 'restricted') return;
            await db.$executeRaw`
              INSERT INTO "LoginAttempt" ("id", "email", "userId", "success", "ipAddress", "userAgent")
              SELECT gen_random_uuid()::text, "email", "id", true,
                     ${session.ipAddress?.slice(0, 64) ?? null}, ${session.userAgent?.slice(0, 512) ?? null}
              FROM "user" WHERE "id" = ${session.userId} FOR KEY SHARE
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


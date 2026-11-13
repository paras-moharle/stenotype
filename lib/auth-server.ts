import { createHmac, timingSafeEqual } from 'crypto';

// ─────────────────────────────────────────────────────────────
// SERVER-ONLY auth module.
// Credentials live in environment variables and are NEVER
// bundled into the browser. The client only talks to /api/login
// and receives an HTTP-only cookie.
// ─────────────────────────────────────────────────────────────

export type ServerUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'student';
};

type Account = ServerUser & { password: string };

// Login is valid for 10 days (within the 7–15 day window).
export const SESSION_MAX_AGE_SECONDS = 10 * 24 * 60 * 60;
export const SESSION_COOKIE = 'stenotype_session';

const AUTH_SECRET =
  process.env.AUTH_SECRET ?? 'change-me-in-production-please';

function accounts(): Account[] {
  return [
    {
      id: 'u1',
      name: 'Abhijeet Chahare',
      email: process.env.STUDENT_EMAIL ?? 'abhijeet@stenotype.test',
      role: 'student',
      password: process.env.STUDENT_PASSWORD ?? 'stenotype123',
    },
    {
      id: 'u2',
      name: 'Paras Moharle',
      email: process.env.ADMIN_EMAIL ?? 'paras@stenotype.test',
      role: 'admin',
      password: process.env.ADMIN_PASSWORD ?? 'stenotype123',
    },
  ];
}

export function findAccount(email: string, password: string): ServerUser | null {
  const account = accounts().find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (!account) return null;
  if (account.password !== password) return null;
  const { password: _pw, ...user } = account;
  return user;
}

export function getUserByEmail(email: string): ServerUser | null {
  const account = accounts().find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (!account) return null;
  const { password: _pw, ...user } = account;
  return user;
}

/* ─── Signed session token (HMAC-SHA256) ─────────────────── */

export function signToken(email: string): string {
  const payload = Buffer.from(email).toString('base64url');
  const sig = createHmac('sha256', AUTH_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', AUTH_SECRET)
    .update(payload)
    .digest('base64url');
  try {
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return Buffer.from(payload, 'base64url').toString();
}

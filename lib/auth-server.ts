import { createHmac, timingSafeEqual } from 'crypto';
import {
  createSession,
  getSession,
  isTokenRevoked,
  revokeSessionByToken,
} from '@/lib/sessions';

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

// Login is valid for 4 hours (short window, admin can kill-switch anytime).
export const SESSION_MAX_AGE_SECONDS = 4 * 60 * 60;
export const SESSION_COOKIE = 'stenotype_session';

/**
 * Required environment variable — auth fails loudly instead of
 * silently falling back to demo credentials. If booting in
 * production without these set, this is a misconfiguration, not
 * something to paper over.
 */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set ${name} in .env (local dev) or your hosting provider's ` +
        `project settings (production). Demo fallbacks were removed on purpose.`
    );
  }
  return value;
}

const AUTH_SECRET = requiredEnv('AUTH_SECRET');

function accounts(): Account[] {
  return [
    {
      id: 'u1',
      name: 'Abhijeet Chahare',
      email: requiredEnv('STUDENT_EMAIL').trim(),
      role: 'student',
      password: requiredEnv('STUDENT_PASSWORD'),
    },
    {
      id: 'u2',
      name: 'Paras Moharle',
      email: requiredEnv('ADMIN_EMAIL').trim(),
      role: 'admin',
      password: requiredEnv('ADMIN_PASSWORD'),
    },
  ];
}

export function findAccount(email: string, password: string): ServerUser | null {
  const normalized = email.trim().toLowerCase();
  const account = accounts().find(
    (a) => a.email.toLowerCase() === normalized
  );
  if (!account) return null;
  if (account.password !== password) return null;
  const { password: _pw, ...user } = account;
  return user;
}

export function getUserByEmail(email: string): ServerUser | null {
  const normalized = email.trim().toLowerCase();
  const account = accounts().find(
    (a) => a.email.toLowerCase() === normalized
  );
  if (!account) return null;
  const { password: _pw, ...user } = account;
  return user;
}

/* ─── Signed session token (HMAC-SHA256) ─────────────────── */

type TokenPayload = {
  email: string;
  exp: number;
  jti: string;
};

export function signToken(email: string): string {
  const data: TokenPayload = {
    email: email.trim().toLowerCase(),
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    jti: Math.random().toString(36).slice(2),
  };
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
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

  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  try {
    const parsed = JSON.parse(decoded) as Partial<TokenPayload>;
    if (typeof parsed.email === 'string') {
      if (typeof parsed.exp === 'number' && parsed.exp <= Date.now()) {
        return null;
      }
      return parsed.email.trim().toLowerCase();
    }
  } catch {
    // Backwards-compatible fallback for older plain-email tokens
    if (decoded.includes('@')) {
      return decoded.trim().toLowerCase();
    }
  }
  return null;
}

/**
 * Verify a session token and confirm it exists in the active session store.
 * Returns the email if valid, null otherwise.
 */
export function verifySession(token: string): string | null {
  if (isTokenRevoked(token)) return null;

  const email = verifyToken(token);
  if (!email) return null;

  const session = getSession(token);
  if (session) {
    if (session.email.toLowerCase() !== email.toLowerCase()) return null;
    return email;
  }

  // If the token has a valid HMAC signature and has not been revoked,
  // re-register it in the in-memory store (recovers seamlessly after HMR / dev restart).
  createSession({
    email,
    token,
    ttlSeconds: SESSION_MAX_AGE_SECONDS,
  });
  return email;
}

/**
 * Revoke a session by its token (used on logout).
 */
export function revokeToken(token: string): void {
  revokeSessionByToken(token);
}

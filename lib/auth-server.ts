import {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import {
  getSession,
  isTokenRevoked,
  revokeSessionByToken,
} from '@/lib/sessions';

// ─────────────────────────────────────────────────────────────
// SERVER-ONLY auth module.
// Credentials live in environment variables and are NEVER
// bundled into the browser. The client only talks to /api/login
// and receives an HTTP-only cookie.
//
// Hardening (Chunk 4):
//  - AUTH_SECRET is read lazily, so importing this module never
//    throws on public pages that don't need auth.
//  - Env passwords are scrypt-hashed once at startup; plaintext
//    is never stored, and comparison is constant-time.
//  - Session tokens use crypto.randomUUID() for the jti.
//  - No legacy plain-email token fallback (old tokens are dead).
//  - verifySession does NOT re-register unknown tokens — a valid
//    HMAC alone is not enough; the session must exist in the
//    store. After a restart, users simply sign in again.
// ─────────────────────────────────────────────────────────────

export type ServerUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'student';
};

type Account = ServerUser & {
  salt: Buffer;
  passwordHash: Buffer;
};

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

// Lazy secret: read on first use (and cache) so that merely
// importing this module — e.g. transitively from a public page —
// never throws just because auth env is absent.
let cachedSecret: string | null = null;
function getAuthSecret(): string {
  if (cachedSecret === null) {
    cachedSecret = requiredEnv('AUTH_SECRET');
  }
  return cachedSecret;
}

function hashPassword(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 64);
}

// Env passwords are hashed once (per process) with a random salt.
// The plaintext from env is used only during this startup step and
// is never retained in memory afterwards.
let cachedAccounts: Account[] | null = null;
function accounts(): Account[] {
  if (cachedAccounts) return cachedAccounts;

  const defs = [
    {
      id: 'u1',
      name: 'Abhijeet Chahare',
      email: requiredEnv('STUDENT_EMAIL').trim(),
      role: 'student' as const,
      password: requiredEnv('STUDENT_PASSWORD'),
    },
    {
      id: 'u2',
      name: 'Paras Moharle',
      email: requiredEnv('ADMIN_EMAIL').trim(),
      role: 'admin' as const,
      password: requiredEnv('ADMIN_PASSWORD'),
    },
  ];

  if (
    defs[0].email.toLowerCase() === defs[1].email.toLowerCase()
  ) {
    throw new Error(
      'STUDENT_EMAIL and ADMIN_EMAIL must be different accounts.'
    );
  }

  cachedAccounts = defs.map((def) => {
    const salt = randomBytes(16);
    return {
      id: def.id,
      name: def.name,
      email: def.email,
      role: def.role,
      salt,
      passwordHash: hashPassword(def.password, salt),
    };
  });

  return cachedAccounts;
}

function publicUser(account: Account): ServerUser {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
  };
}

export function findAccount(
  email: string,
  password: string
): ServerUser | null {
  const normalized = email.trim().toLowerCase();
  const account = accounts().find(
    (a) => a.email.toLowerCase() === normalized
  );
  if (!account) return null;

  const candidate = hashPassword(password, account.salt);
  if (
    candidate.length !== account.passwordHash.length ||
    !timingSafeEqual(candidate, account.passwordHash)
  ) {
    return null;
  }

  return publicUser(account);
}

export function getUserByEmail(email: string): ServerUser | null {
  const normalized = email.trim().toLowerCase();
  const account = accounts().find(
    (a) => a.email.toLowerCase() === normalized
  );
  return account ? publicUser(account) : null;
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
    jti: randomUUID(),
  };
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = createHmac('sha256', getAuthSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', getAuthSecret())
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
    // Not a JSON payload — invalid. The old plain-email fallback
    // (which never expired) has been removed on purpose.
  }
  return null;
}

/**
 * Verify a session token and confirm it exists in the active session store.
 * Returns the email if valid, null otherwise.
 *
 * A valid HMAC signature alone is NOT enough: the token must also be
 * present in the store. This keeps revocation and the single-active-
 * session rule intact across restarts — after a restart the store is
 * empty, so existing cookies simply require a fresh sign-in.
 */
export function verifySession(token: string): string | null {
  if (isTokenRevoked(token)) return null;

  const email = verifyToken(token);
  if (!email) return null;

  const session = getSession(token);
  if (!session) return null;
  if (session.email.toLowerCase() !== email.toLowerCase()) return null;
  return email;
}

/**
 * Revoke a session by its token (used on logout).
 */
export function revokeToken(token: string): void {
  revokeSessionByToken(token);
}


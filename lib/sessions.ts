/**
 * In-memory session store — single active session per account.
 *
 * When a user logs in, any previous session for that email is revoked,
 * so only one person can be logged into an account at a time.
 *
 * Sessions expire after a short TTL (default 4 hours) unless the
 * admin revokes them earlier via the kill-switch endpoint.
 */

export type Session = {
  token: string;
  email: string;
  expiresAt: number;
  createdAt: number;
  ip?: string;
  userAgent?: string;
};

const sessions = new Map<string, Session>(); // keyed by token
const sessionsByEmail = new Map<string, string>(); // email -> token

const DEFAULT_TTL_SECONDS = 4 * 60 * 60; // 4 hours

export function getDefaultTtlSeconds(): number {
  return DEFAULT_TTL_SECONDS;
}

export function createSession({
  email,
  token,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  ip,
  userAgent,
}: {
  email: string;
  token: string;
  ttlSeconds?: number;
  ip?: string;
  userAgent?: string;
}): void {
  // Revoke any existing session for this email (single active session).
  const existingToken = sessionsByEmail.get(email);
  if (existingToken) {
    sessions.delete(existingToken);
  }

  const now = Date.now();
  const session: Session = {
    token,
    email,
    expiresAt: now + ttlSeconds * 1000,
    createdAt: now,
    ip,
    userAgent,
  };

  sessions.set(token, session);
  sessionsByEmail.set(email, token);

  // Auto-cleanup after expiry.
  setTimeout(() => {
    const s = sessions.get(token);
    if (s && s.expiresAt <= Date.now()) {
      sessions.delete(token);
      sessionsByEmail.delete(s.email);
    }
  }, ttlSeconds * 1000);
}

export function getSession(token: string): Session | null {
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expiresAt <= Date.now()) {
    sessions.delete(token);
    sessionsByEmail.delete(s.email);
    return null;
  }
  return s;
}

export function revokeSession(email: string): boolean {
  const token = sessionsByEmail.get(email);
  if (!token) return false;
  sessions.delete(token);
  sessionsByEmail.delete(email);
  return true;
}

export function revokeSessionByToken(token: string): boolean {
  const s = sessions.get(token);
  if (!s) return false;
  sessions.delete(token);
  sessionsByEmail.delete(s.email);
  return true;
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values()).filter((s) => s.expiresAt > Date.now());
}

export function getSessionCount(): number {
  return getAllSessions().length;
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [token, s] of Array.from(sessions.entries())) {
    if (s.expiresAt <= now) {
      sessions.delete(token);
      sessionsByEmail.delete(s.email);
    }
  }
}

// Run cleanup every 5 minutes.
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

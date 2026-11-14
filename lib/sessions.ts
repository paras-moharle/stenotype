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

type GlobalSessionStore = {
  sessions: Map<string, Session>;
  sessionsByEmail: Map<string, string>;
  revokedTokens: Map<string, number>;
  cleanupTimerStarted?: boolean;
};

const globalStore = (globalThis as unknown as {
  __stenotypeSessionStore?: GlobalSessionStore;
}).__stenotypeSessionStore ??
  ({
    sessions: new Map<string, Session>(),
    sessionsByEmail: new Map<string, string>(),
    revokedTokens: new Map<string, number>(),
  } as GlobalSessionStore);

(globalThis as unknown as { __stenotypeSessionStore?: GlobalSessionStore }).__stenotypeSessionStore =
  globalStore;

const { sessions, sessionsByEmail, revokedTokens } = globalStore;

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
  const normalizedEmail = email.trim().toLowerCase();
  const existingToken = sessionsByEmail.get(normalizedEmail);
  if (existingToken && existingToken !== token) {
    const prev = sessions.get(existingToken);
    revokedTokens.set(
      existingToken,
      prev?.expiresAt ?? Date.now() + ttlSeconds * 1000
    );
    sessions.delete(existingToken);
  }

  const now = Date.now();
  const session: Session = {
    token,
    email: normalizedEmail,
    expiresAt: now + ttlSeconds * 1000,
    createdAt: now,
    ip,
    userAgent,
  };

  revokedTokens.delete(token);
  sessions.set(token, session);
  sessionsByEmail.set(normalizedEmail, token);
}

export function isTokenRevoked(token: string): boolean {
  const exp = revokedTokens.get(token);
  if (!exp) return false;
  if (exp <= Date.now()) {
    revokedTokens.delete(token);
    return false;
  }
  return true;
}

export function getSession(token: string): Session | null {
  if (isTokenRevoked(token)) return null;

  const s = sessions.get(token);
  if (!s) return null;
  if (s.expiresAt <= Date.now()) {
    sessions.delete(token);
    if (sessionsByEmail.get(s.email) === token) {
      sessionsByEmail.delete(s.email);
    }
    return null;
  }
  return s;
}

export function revokeSession(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const token = sessionsByEmail.get(normalizedEmail);
  if (!token) return false;
  const s = sessions.get(token);
  revokedTokens.set(
    token,
    s?.expiresAt ?? Date.now() + DEFAULT_TTL_SECONDS * 1000
  );
  sessions.delete(token);
  sessionsByEmail.delete(normalizedEmail);
  return true;
}

export function revokeSessionByToken(token: string): boolean {
  const s = sessions.get(token);
  revokedTokens.set(
    token,
    s?.expiresAt ?? Date.now() + DEFAULT_TTL_SECONDS * 1000
  );
  if (!s) return false;
  sessions.delete(token);
  if (sessionsByEmail.get(s.email) === token) {
    sessionsByEmail.delete(s.email);
  }
  return true;
}

export function getAllSessions(): Session[] {
  cleanupExpiredSessions();
  return Array.from(sessions.values()).sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

export function getSessionCount(): number {
  return getAllSessions().length;
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [token, s] of Array.from(sessions.entries())) {
    if (s.expiresAt <= now) {
      sessions.delete(token);
      if (sessionsByEmail.get(s.email) === token) {
        sessionsByEmail.delete(s.email);
      }
    }
  }
  for (const [token, exp] of Array.from(revokedTokens.entries())) {
    if (exp <= now) {
      revokedTokens.delete(token);
    }
  }
}

if (!globalStore.cleanupTimerStarted) {
  globalStore.cleanupTimerStarted = true;
  const timer = setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
  if (typeof timer === 'object' && 'unref' in timer) {
    timer.unref();
  }
}

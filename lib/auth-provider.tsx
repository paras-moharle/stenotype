'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { messageFrom } from './auth-errors';

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'student';
};

type AuthContextValue = {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Cross-tab sign-out signal. The `storage` event only fires in *other*
 * tabs, so a tab that was left open on the dashboard drops its local
 * user state and bounces to /login as soon as one tab signs out.
 */
const SIGNED_OUT_KEY = 'stenotype:signed-out-at';
const SIGNED_OUT_TTL_MS = 10_000;

/**
 * Fetches /api/auth/get-session ONCE for the whole app and shares the
 * result via context. Mounted at the root layout, so navigating between
 * public pages (About) and protected areas (Practice) never refetches —
 * this is what stops the student layout from flashing its
 * "Checking your session…" spinner on every navigation.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/get-session', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        setUser(data?.user ?? null);
        return;
      }

      // Only a 401 means the session is genuinely dead. A 429/500/503
      // is transient — keep whatever we already know instead of
      // flashing the user out on a hiccup.
      if (res.status === 401) {
        setUser(null);
        try {
          await fetch('/api/auth/sign-out', {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* network hiccup — keep the current state */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sign out in one tab → drop the user in every other tab.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SIGNED_OUT_KEY || !event.newValue) return;
      const at = Number(event.newValue);
      if (!Number.isFinite(at) || Date.now() - at > SIGNED_OUT_TTL_MS) return;
      setUser(null);
      window.location.replace('/login');
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * Sign in against the server. Credentials are checked server-side
   * and the session is stored in an HTTP-only cookie — the password
   * never touches client-visible storage or the bundle.
   *
   * A hard redirect guarantees the new cookie is used immediately,
   * so the dashboard renders straight away.
   */
  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);

      if (res.status === 429) {
        throw new Error(
          messageFrom(
            data,
            'Too many sign-in attempts. Please wait a few seconds and try again.'
          )
        );
      }

      throw new Error(
        messageFrom(data, 'Invalid email or password')
      );
    }

    const data = await res.json();
    const signedIn = data?.user as AppUser | undefined;
    if (!signedIn) {
      throw new Error('Sign in succeeded but no user was returned.');
    }
    setUser(signedIn);

    const target =
      signedIn.role === 'admin' ? '/admin' : '/student/dashboard';
    window.location.replace(target);
    return signedIn;
  }, []);

  /**
   * Sign out.
   *
   * The cookie is HttpOnly and (over HTTPS) carries the `__Secure-`
   * prefix, so JavaScript cannot clear it — only the server's
   * `Set-Cookie` can. That is why this must succeed: a swallowed
   * failure leaves the session alive and the login page then bounces
   * the user straight back to their dashboard.
   */
  const signOut = useCallback(async () => {
    // Clear the UI immediately; the redirect happens once the server
    // has had its say.
    setUser(null);

    const post = (url: string) =>
      fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

    try {
      const res = await post('/api/auth/sign-out');
      if (!res.ok) {
        // Fallback: our own route calls auth.api.signOut() with the
        // incoming cookies and forwards its Set-Cookie headers.
        await post('/api/logout');
      }
    } catch {
      try {
        await post('/api/logout');
      } catch {
        /* offline — nothing more we can do */
      }
    }

    try {
      localStorage.setItem(SIGNED_OUT_KEY, String(Date.now()));
    } catch {
      /* storage disabled */
    }

    window.location.replace('/login');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      refresh,
      signIn,
      signOut,
    }),
    [user, isLoading, refresh, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}

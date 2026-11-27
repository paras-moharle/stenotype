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

import { signInFailure } from './auth-errors';

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
 * Shares the signed-in user across a route area.
 *
 * Protected layouts pass `initialUser` from their server-side session,
 * so signing in already costs one session read — the client does not
 * fetch `/api/auth/get-session` a second time just to paint the header,
 * and there is no "Sign in" flash before the real name appears.
 *
 * Public pages mount it without a seed and fetch once on navigation.
 */
export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  /**
   * Server-provided user. `null` means "definitely signed out" and also
   * skips the fetch. Omit it to let the provider fetch.
   */
  initialUser?: AppUser | null;
}) {
  const seeded = initialUser !== undefined;
  const [user, setUser] = useState<AppUser | null>(initialUser ?? null);
  const [isLoading, setIsLoading] = useState(!seeded);

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
    if (seeded) return;
    // The provider is seeded once per mount; refresh() writes the result.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [seeded, refresh]);

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
    let res: Response;
    try {
      res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error('Could not reach StenoType. Check your connection and try again.');
    }

    if (!res.ok) throw new Error(signInFailure(res.status, await res.json().catch(() => null)));

    const data = await res.json();
    const signedIn = data?.user as AppUser | undefined;
    if (!signedIn) {
      throw new Error('Sign-in is temporarily unavailable. Try again shortly.');
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
    const post = (url: string) =>
      fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

    const attempt = async (url: string) => {
      try {
        const res = await post(url);
        return res.ok;
      } catch {
        return false;
      }
    };

    const signedOut =
      await attempt('/api/auth/sign-out');

    if (!signedOut) {
      // Do NOT pretend the session ended. The cookie is HttpOnly, so a
      // live session would silently sign the user straight back in and
      // look like "sign out does nothing".
      window.location.replace('/login?signout=failed');
      return;
    }

    setUser(null);

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
      signIn,
      signOut,
    }),
    [user, isLoading, signIn, signOut]
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

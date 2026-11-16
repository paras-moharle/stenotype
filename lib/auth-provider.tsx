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
 * Fetches /api/me ONCE for the whole app and shares the result via
 * context. Mounted at the root layout, so navigating between public
 * pages (About) and protected areas (Practice) never refetches —
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
        const data = await res.json();
        setUser(data?.user ?? null);
      } else {
        setUser(null);
        // Only a 401 means the session is genuinely dead — clear
        // the cookie so proxy.ts stops redirecting to it. Other
        // errors (500/503 during a deploy) must not log the user
        // out or revoke a still-valid session.
        if (res.status === 401) {
          try {
            await fetch('/api/auth/sign-out', {
              method: 'POST',
              credentials: 'same-origin',
              cache: 'no-store',
            });
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      throw new Error(data?.error ?? 'Invalid email or password');
    }

    const data = await res.json();
    const signedIn = data.user as AppUser;
    setUser(signedIn);

    const target =
      signedIn.role === 'admin' ? '/admin' : '/student/dashboard';
    window.location.replace(target);
    return signedIn;
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    try {
      const res = await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      // Wait for cookie to be cleared
      if (res.ok) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch {
      /* ignore network errors */
    }
    window.location.href = '/login';
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



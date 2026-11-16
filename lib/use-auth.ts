'use client';

import { useCallback, useEffect, useState } from 'react';

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'student';
};

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = user !== null;

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
        // Stale session cookie — clear it so proxy.ts doesn't keep
        // redirecting to a dead session.
        setUser(null);
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
  const signIn = async (email: string, password: string) => {
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
      signedIn.role === 'admin' ? '/admin' : '/student/typing';
    window.location.replace(target);
    return signedIn;
  };

  const signOut = async () => {
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      });
    } catch {
      /* ignore network errors — still redirect */
    }
    setUser(null);
    window.location.replace('/');
  };

  return { user, isAuthenticated, isLoading, refresh, signIn, signOut };
}


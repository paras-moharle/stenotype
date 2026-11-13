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

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      const data = res.ok ? await res.json() : null;
      setUser(data?.user ?? null);
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
    const res = await fetch('/api/login', {
      method: 'POST',
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
    window.location.assign(
      signedIn.role === 'admin' ? '/admin' : '/student/dashboard'
    );
    return signedIn;
  };

  const signOut = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      /* ignore network errors — still redirect */
    }
    setUser(null);
    window.location.assign('/');
  };

  return {
    user,
    session: null,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signOut,
    refresh,
  };
}

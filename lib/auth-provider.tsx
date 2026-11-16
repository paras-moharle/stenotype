'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { authClient } from './auth-client';

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
 * Shares Better Auth session state across the whole app. Mounted at
 * the root layout, so /api/auth/get-session is fetched once and
 * navigating between public pages (About) and protected areas
 * (Practice) never refetches — no "Checking your session…"
 * spinner on every navigation.
 *
 * The public shape ({ user, isAuthenticated, isLoading, signIn,
 * signOut, refresh }) is unchanged from the old env-auth hook, so
 * existing components keep working.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending, refetch } = authClient.useSession();

  // Narrow the role explicitly: Better Auth types it as
  // string | undefined, but our DB only ever stores 'admin' or
  // 'student'. Anything else (missing/unknown) is treated as
  // 'student' so an admin can never be misrouted to the student
  // dashboard and bounced back to /login.
  const rawUser = session?.user ?? null;
  const user: AppUser | null = rawUser
    ? {
        id: rawUser.id,
        name: rawUser.name,
        email: rawUser.email,
        role: rawUser.role === 'admin' ? 'admin' : 'student',
      }
    : null;
  const isLoading = isPending;
  const isAuthenticated = user !== null;

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await authClient.signIn.email({
      email,
      password,
    });
    if (error) {
      throw new Error(error.message || 'Invalid email or password');
    }
    const signedIn: AppUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role === 'admin' ? 'admin' : 'student',
    };
    const target =
      signedIn.role === 'admin' ? '/admin' : '/student/dashboard';
    window.location.replace(target);
    return signedIn;
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    window.location.replace('/');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      refresh,
      signIn,
      signOut,
    }),
    [user, isAuthenticated, isLoading, refresh, signIn, signOut]
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


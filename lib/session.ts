import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from './auth';

/**
 * Per-request session lookup.
 *
 * `React.cache` dedupes calls within a single render pass, so the
 * layout and the page below it can both ask for the session and only
 * one DB round-trip happens.
 *
 * Cookie caching is disabled in lib/auth.ts, so this reads the session
 * and its user from the database on every request — the role and ban
 * flag it returns are authoritative, not cached from a previous visit.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

export type CurrentUser = {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
};

/**
 * Session plus the role/ban flags.
 *
 * The admin plugin puts `role` and `banned` on the session user, and the
 * session is re-read from the database on every request, so this does
 * NOT need a second query. It used to run `user.findUnique` again —
 * one avoidable round-trip on every protected page.
 */
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => {
    const session = await getSession();
    if (!session?.user) return null;

    return {
      session,
      id: session.user.id,
      name: session.user.name ?? '',
      email: session.user.email ?? '',
      role: session.user.role ?? 'student',
      banned: Boolean(session.user.banned),
    };
  }
);

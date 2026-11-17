import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from './auth';
import { db } from './db';

/**
 * Per-request session lookup.
 *
 * `React.cache` dedupes calls within a single render pass, so the
 * layout and the page below it can both ask for the session and only
 * one DB round-trip happens. Without this, every protected page paid
 * for `getSession` twice (once in the layout, once in the page).
 */
export const getSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

export type CurrentUser = {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  id: string;
  role: string;
  banned: boolean;
};

/**
 * Session + the authoritative role/banned flags from the database.
 * Cached per request for the same reason as `getSession`.
 */
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => {
    const session = await getSession();
    if (!session?.user) return null;

    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, banned: true },
    });
    if (!dbUser) return null;

    return {
      session,
      id: dbUser.id,
      role: dbUser.role,
      banned: Boolean(dbUser.banned),
    };
  }
);

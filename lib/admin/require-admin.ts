import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * Admin gate for route handlers.
 *
 * Every admin route used to repeat the same twelve lines: resolve the
 * session, look the role up in the database, return 401 or 403. One
 * helper means the check cannot be forgotten in a new route and the
 * behaviour stays identical everywhere.
 *
 * The role is read from the database (not the session payload), so a
 * demotion takes effect immediately.
 */

export type AdminGate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminGate> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // A banned admin must lose API access even if a session survived.
  if (session.user.banned) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'This account is suspended.' },
        { status: 403 }
      ),
    };
  }

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (me?.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, userId: session.user.id };
}

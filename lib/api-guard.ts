import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * Request guards for the student-facing API.
 *
 * The page layouts already block banned/suspended users, but a page
 * guard is not an API guard: anyone with a session cookie can call the
 * endpoints directly with devtools or curl. These helpers re-check the
 * session, the ban flag and the student status on every request.
 */

export type UserGate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireUser(): Promise<UserGate> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // The session is re-read from the database (cookie caching is off), so
  // this flag is current even if the ban happened after sign-in.
  if (session.user.banned) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'This account is suspended.' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId: session.user.id };
}

export type StudentGate =
  | { ok: true; userId: string; profileId: string }
  | { ok: false; response: NextResponse };

/**
 * A signed-in, non-banned user that also has a student profile which is
 * not suspended.
 */
export async function requireStudent(): Promise<StudentGate> {
  const gate = await requireUser();
  if (!gate.ok) return gate;

  const profile = await db.studentProfile.findUnique({
    where: { userId: gate.userId },
    select: { id: true, status: true },
  });

  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Student profile not found' },
        { status: 404 }
      ),
    };
  }

  if (profile.status === 'SUSPENDED') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'This student account is suspended.' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId: gate.userId, profileId: profile.id };
}

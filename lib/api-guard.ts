import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * Request guards for the student-facing API.
 *
 * Student pages and APIs enforce account access independently. A page
 * guard is not an API guard: anyone with a session cookie can call the
 * endpoints directly with devtools or curl. These helpers re-check the
 * session, the ban flag and the student status on every request.
 */

export type UserGate =
  | { ok: true; userId: string; sessionId: string }
  | { ok: false; response: Response };

export async function requireUser(): Promise<UserGate> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // The session is re-read from the database (cookie caching is off), so
  // this flag is current even if the ban happened after sign-in.
  if (session.user.banned || session.user.role !== 'student') {
    return {
      ok: false,
      response: Response.json(
        { error: 'Student access is unavailable for this account.' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId: session.user.id, sessionId: session.session.id };
}

export function findStudentProfile(userId: string) {
  return db.studentProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
}

export type StudentGate =
  | { ok: true; userId: string; profileId: string; sessionId: string }
  | { ok: false; response: Response };

/**
 * A signed-in, non-banned user that also has a student profile which is
 * active. INACTIVE and SUSPENDED are both blocked: an inactive student
 * must not be able to submit attempts or read student data.
 */
export async function requireStudent(): Promise<StudentGate> {
  const gate = await requireUser();
  if (!gate.ok) return gate;

  const profile = await findStudentProfile(gate.userId);

  if (!profile) {
    return {
      ok: false,
      response: Response.json(
        { error: 'Student profile not found' },
        { status: 404 }
      ),
    };
  }

  if (profile.status !== 'ACTIVE') {
    return {
      ok: false,
      response: Response.json(
        { error: 'This student account is not active.' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId: gate.userId, profileId: profile.id, sessionId: gate.sessionId };
}

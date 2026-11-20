import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/student/attempts
 *
 * The signed-in student's own dictation attempts, newest first.
 * Query params: ?dictationId=... (optional filter)
 *
 * Every stored attempt belongs to a dictation; rows without one are
 * legacy free/custom attempts from before persistence was restricted,
 * and are excluded so the history only ever shows dictation results.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    return NextResponse.json(
      { error: 'Student profile not found' },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const dictationId = url.searchParams.get('dictationId');

  const attempts = await db.typingAttempt.findMany({
    where: {
      studentId: profile.id,
      // Only dictation attempts are real results.
      dictationId: dictationId ?? { not: null },
    },
    include: {
      dictation: {
        select: { id: true, title: true, category: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ attempts });
}

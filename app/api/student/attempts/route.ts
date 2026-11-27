import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dictationAttemptsWhere, dictationHistorySelect } from '@/lib/dictation-history';
import { requireStudent } from '@/lib/api-guard';

/**
 * GET /api/student/attempts
 *
 * The signed-in student's own dictation attempts, newest first.
 * Query params: ?dictationId=... (optional filter)
 *
 * Every stored attempt belongs to a dictation, so the history only ever
 * shows dictation results.
 */
export async function GET(request: Request) {
  const gate = await requireStudent();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const dictationId = url.searchParams.get('dictationId');

  const attempts = await db.typingAttempt.findMany({
    where: {
      ...dictationAttemptsWhere,
      studentId: gate.profileId,
      ...(dictationId ? { dictationId } : {}),
    },
    // Never load `typedText`: it can be ~20 KB per row and no screen
    // that reads this endpoint displays it.
    select: dictationHistorySelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
  });

  return NextResponse.json({ attempts });
}

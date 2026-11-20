import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireStudent } from '@/lib/api-guard';

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
  const gate = await requireStudent();
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const dictationId = url.searchParams.get('dictationId');

  const attempts = await db.typingAttempt.findMany({
    where: {
      studentId: gate.profileId,
      // Only dictation attempts are real results.
      dictationId: dictationId ?? { not: null },
    },
    // Never load `typedText`: it can be ~20 KB per row and no screen
    // that reads this endpoint displays it.
    select: {
      id: true,
      wpm: true,
      accuracy: true,
      completion: true,
      wordsCorrect: true,
      wordsIncorrect: true,
      wordsExtra: true,
      wordsMissed: true,
      wordsTotal: true,
      punctuationCorrect: true,
      punctuationIncorrect: true,
      punctuationExtra: true,
      punctuationMissed: true,
      punctuationTotal: true,
      completed: true,
      createdAt: true,
      dictation: { select: { id: true, title: true, category: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ attempts });
}

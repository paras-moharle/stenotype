import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { attemptSubmissionSchema } from '@/lib/schemas';
import { align, scoreFromAlignment } from '@/lib/typing/scoring';

/**
 * POST /api/attempts
 *
 * Server-side scoring for a dictation attempt.
 *
 * Only dictation results are persisted. Free practice and custom text
 * stay in the browser, so a submission MUST name a published dictation
 * — there is no `customText` escape hatch. The client sends only what
 * it produced (typed text + elapsed time); the server owns the score,
 * the completion flag and the attempt id.
 *
 * Body (validated by attemptSubmissionSchema):
 * {
 *   passageId: string,   // published dictation id
 *   typed: string,       // exactly what the student typed
 *   elapsedMs: number,   // first keystroke -> submit
 * }
 */
export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Find student profile ──────────────────────────────
  const profile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    return NextResponse.json(
      { error: 'Student profile not found' },
      { status: 404 }
    );
  }

  // ── Validate input ────────────────────────────────────
  const body = await request.json().catch(() => null);
  const parsed = attemptSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid submission', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { typed, elapsedMs, passageId } = parsed.data;

  if (typed.trim().length === 0) {
    return NextResponse.json(
      { error: 'Nothing was typed — this attempt was not recorded' },
      { status: 400 }
    );
  }

  // ── Resolve the dictation ─────────────────────────────
  // The transcript is fetched server-side only. The client never
  // receives the reference text before scoring.
  const dictation = await db.dictation.findUnique({
    where: { id: passageId },
    select: { id: true, referenceTranscript: true, status: true },
  });

  if (!dictation || dictation.status !== 'PUBLISHED') {
    return NextResponse.json(
      { error: 'Dictation not found' },
      { status: 404 }
    );
  }

  const reference = dictation.referenceTranscript;

  // ── Server-side scoring ───────────────────────────────
  // The engine is the single source of truth.
  let score;
  try {
    const alignment = align(reference, typed);
    score = scoreFromAlignment(alignment, elapsedMs);
  } catch {
    // align() throws RangeError when input exceeds MAX_ALIGN_CHARS.
    return NextResponse.json(
      { error: 'Input too large to score' },
      { status: 400 }
    );
  }

  // ── Store the attempt ─────────────────────────────────
  // `completed` is derived, not claimed: it means the passage was
  // transcribed to the end.
  const attempt = await db.typingAttempt.create({
    data: {
      studentId: profile.id,
      dictationId: dictation.id,
      typedText: typed,
      elapsedMs,
      wpm: score.netWpm,
      accuracy: score.accuracy,
      completion: score.completion,
      wordsCorrect: score.words.correct,
      wordsTotal: score.words.total,
      completed: score.completion >= 100,
    },
  });

  // ── Return the server-computed score ──────────────────
  // The client displays THIS, not its own computation. The reference
  // is included for the review display (only after scoring).
  return NextResponse.json({
    attemptId: attempt.id,
    reference,
    completed: attempt.completed,
    score: {
      accuracy: score.accuracy,
      completion: score.completion,
      netWpm: score.netWpm,
      rawWpm: score.rawWpm,
      scored: score.scored,
      words: {
        correct: score.words.correct,
        incorrect: score.words.incorrect,
        missed: score.words.missed,
        extra: score.words.extra,
        total: score.words.total,
      },
      punctuation: {
        correct: score.punctuation.correct,
        incorrect: score.punctuation.incorrect,
        missed: score.punctuation.missed,
        extra: score.punctuation.extra,
        total: score.punctuation.total,
      },
    },
  });
}

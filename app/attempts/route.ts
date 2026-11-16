import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessionSubmissionSchema } from '@/lib/schemas';
import { align, scoreFromAlignment } from '@/lib/typing/scoring';

/**
 * POST /api/attempts
 *
 * Server-side re-scoring endpoint. The client sends only the raw
 * typed text, the reference text (or passage ID), and timing —
 * the server runs the scoring engine and stores the result.
 * Client-computed scores are never trusted.
 *
 * Body (validated by sessionSubmissionSchema):
 * {
 *   passageId?: string,      // ID of a TypingTest (if applicable)
 *   customText?: string,     // Reference text for custom/free mode
 *   typed: string,           // What the student typed
 *   elapsedMs: number,       // Time taken in milliseconds
 *   clientWpm: number,       // Ignored (server re-computes)
 *   clientAccuracy: number,  // Ignored (server re-computes)
 *   durationSetting: 15|30|60,
 *   completed: boolean,
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
  const parsed = sessionSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid submission', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { typed, elapsedMs, passageId, customText, completed } =
    parsed.data;

  // ── Resolve reference text ────────────────────────────
  let reference: string | null = null;

  if (passageId) {
    const test = await db.typingTest.findUnique({
      where: { id: passageId },
      select: { text: true },
    });
    reference = test?.text ?? null;
  } else if (customText) {
    reference = customText;
  }

  if (!reference) {
    return NextResponse.json(
      { error: 'Reference text not found' },
      { status: 400 }
    );
  }

  // ── Server-side re-scoring ────────────────────────────
  // The engine is the single source of truth. Client scores
  // are ignored entirely.
  let score;
  try {
    const alignment = align(reference, typed);
    score = scoreFromAlignment(alignment, elapsedMs);
  } catch (err) {
    // align() throws RangeError on oversized inputs or DP
    // budget exceeded. Return a clean error, not a 500.
    return NextResponse.json(
      { error: 'Input too large to score' },
      { status: 400 }
    );
  }

  // ── Store the attempt ─────────────────────────────────
  const attempt = await db.typingAttempt.create({
    data: {
      typingTestId: passageId ?? null,
      studentId: profile.id,
      typedText: typed,
      elapsedMs,
      wpm: score.netWpm,
      accuracy: score.accuracy,
      correctCharacters: score.correct,
      incorrectCharacters: score.errors,
      completed,
    },
  });

  // ── Return the server-computed score ──────────────────
  // The client displays THIS, not its own computation.
  return NextResponse.json({
    attemptId: attempt.id,
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


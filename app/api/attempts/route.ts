import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attemptSubmissionSchema } from '@/lib/schemas';
import {
  align,
  MAX_PLAUSIBLE_WPM,
  scoreFromAlignment,
} from '@/lib/typing/scoring';
import { attemptSnapshot } from '@/lib/typing/attempt-snapshot';
import { requireStudent } from '@/lib/api-guard';
import { ATTEMPT_RATE_LIMIT, checkRateLimit } from '@/lib/rate-limit';

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
 * Guards, in order:
 *   1. signed-in, not banned, student profile not suspended
 *   2. per-user rate limit (each call runs an O(n·m) alignment + a write)
 *   3. schema validation
 *   4. published dictation lookup
 *   5. scoring, with a hard work budget (RangeError -> 400)
 *   6. minimum attempt size and a plausible-speed ceiling
 */
export async function POST(request: Request) {
  // 1. Account state
  const gate = await requireStudent();
  if (!gate.ok) return gate.response;

  // 2. Burst guard
  const limit = checkRateLimit(
    `attempts:${gate.userId}`,
    ATTEMPT_RATE_LIMIT.limit,
    ATTEMPT_RATE_LIMIT.windowMs
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a moment and try again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      }
    );
  }

  // 3. Validate
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

  // 4. Resolve the dictation (transcript stays server-side until scored)
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

  // 5. Score
  let score;
  try {
    const alignment = align(dictation.referenceTranscript, typed);
    score = scoreFromAlignment(alignment, elapsedMs);
  } catch {
    return NextResponse.json(
      { error: 'Input too large to score' },
      { status: 400 }
    );
  }

  // 6. Reject attempts the UI already calls unscored, and impossible speed
  if (!score.scored) {
    return NextResponse.json(
      {
        error:
          'This attempt is too short to record. Type for at least 3 seconds and 10 characters.',
      },
      { status: 400 }
    );
  }

  const minutes = Math.max(elapsedMs, 1) / 60_000;
  const rawWpm = typed.length / 5 / minutes;
  if (rawWpm > MAX_PLAUSIBLE_WPM) {
    return NextResponse.json(
      { error: 'That speed is not realistically possible. Attempt not recorded.' },
      { status: 400 }
    );
  }

  // Store the attempt. `completed` is derived, not claimed.
  const snapshot = attemptSnapshot(score);

  const attempt = await db.typingAttempt.create({
    data: {
      studentId: gate.profileId,
      dictationId: dictation.id,
      typedText: typed,
      elapsedMs,
      wpm: score.netWpm,
      accuracy: score.accuracy,
      completed: score.completion >= 100,
      ...snapshot,
    },
  });

  return NextResponse.json({
    attemptId: attempt.id,
    reference: dictation.referenceTranscript,
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

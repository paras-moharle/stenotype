import { createHash } from 'node:crypto';
import { rejectStorageGrowth } from '@/lib/db-capacity';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attemptSubmissionSchema } from '@/lib/schemas';
import { align, MAX_PLAUSIBLE_WPM, scoreFromAlignment } from '@/lib/typing/scoring';
import { attemptSnapshot } from '@/lib/typing/attempt-snapshot';
import { requireStudent } from '@/lib/api-guard';
import { takeSharedQuota } from '@/lib/shared-rate-limit';
import { ATTEMPT_RATE_LIMIT, checkRateLimit } from '@/lib/rate-limit';
import { readJson, rejectCrossOriginMutation } from '@/lib/mutation-request';
import { isUniqueViolation } from '@/lib/prisma-errors';
import type { TypingAttempt } from '@/generated/prisma/client';

export async function POST(request: Request) {
  const rejection = rejectCrossOriginMutation(request);
  if (rejection) return rejection;

  const gate = await requireStudent();
  if (!gate.ok) return gate.response;

  const limit = checkRateLimit(
    `attempts:${gate.userId}`, ATTEMPT_RATE_LIMIT.limit, ATTEMPT_RATE_LIMIT.windowMs
  );
  const throttled = () => NextResponse.json(
    { error: 'Too many attempts. Please wait a moment and try again.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } }
  );
  if (!limit.allowed) {
    // Allow a small number of read-only lookups after saturation so a lost
    // response can be recovered. This path can never create a new attempt.
    const recovery = checkRateLimit(`attempt-recovery:${gate.userId}`, 4, ATTEMPT_RATE_LIMIT.windowMs);
    if (!recovery.allowed) return throttled();
  }

  const body = await readJson(request, 128_000);
  if (!body.ok) return body.response;
  const parsed = attemptSubmissionSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid submission' }, { status: 400 });
  }

  const { typed, elapsedMs, passageId, submissionKey } = parsed.data;
  const key = { studentId_submissionKey: { studentId: gate.profileId, submissionKey } };

  const prior = await db.typingAttempt.findUnique({ where: key, include: { reference: true } });
  if (prior) return replay(prior);
  if (!limit.allowed) return throttled();
  const capacity = await rejectStorageGrowth();
  if (capacity) return capacity;
  if (!(await takeSharedQuota(`attempt:${gate.userId}`, ATTEMPT_RATE_LIMIT.limit, ATTEMPT_RATE_LIMIT.windowMs))) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, {
      status: 429, headers: { 'Retry-After': String(ATTEMPT_RATE_LIMIT.windowMs / 1000) },
    });
  }

  if (!typed.trim()) {
    return NextResponse.json({ error: 'Nothing was typed. This attempt was not recorded.' }, { status: 400 });
  }

  const dictation = await db.dictation.findUnique({
    where: { id: passageId, status: 'PUBLISHED' },
    select: { id: true, referenceTranscript: true },
  });
  if (!dictation) return NextResponse.json({ error: 'Dictation not found' }, { status: 404 });

  let score;
  try {
    score = scoreFromAlignment(align(dictation.referenceTranscript, typed), elapsedMs);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return NextResponse.json({ error: 'This text exceeds the scoring budget.' }, { status: 400 });
  }
  if (!score.scored) {
    return NextResponse.json(
      { error: 'Type for at least 3 seconds and 10 characters to record an attempt.' },
      { status: 400 }
    );
  }
  if (score.typed / 5 / (elapsedMs / 60_000) > MAX_PLAUSIBLE_WPM) {
    return NextResponse.json({ error: 'That speed is not realistically possible.' }, { status: 400 });
  }

  try {
    const transcript = dictation.referenceTranscript;
    const digest = createHash('sha256').update(transcript, 'utf8').digest('hex');
    const attempt = await db.$transaction(async (tx) => {
      await tx.dictationReference.createMany({
        data: { digest, transcript },
        skipDuplicates: true,
      });
      return tx.typingAttempt.create({
        data: {
          studentId: gate.profileId,
          dictationId: dictation.id,
          submissionKey,
          referenceDigest: digest,
          scoreVersion: 1,
          typedText: typed,
          elapsedMs,
          rawWpm: score.rawWpm,
          wpm: score.netWpm,
          accuracy: score.accuracy,
          completed: score.completion >= 100,
          ...attemptSnapshot(score),
        },
      });
    });
    return result(attempt, transcript);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await db.typingAttempt.findUnique({ where: key, include: { reference: true } });
    if (!winner) throw error;
    return replay(winner);
  }

  function replay(attempt: TypingAttempt & { reference: { transcript: string } | null }) {
    if (attempt.dictationId !== passageId || attempt.typedText !== typed || attempt.elapsedMs !== elapsedMs) {
      return NextResponse.json({ error: 'This submission key belongs to a different attempt.' }, { status: 409 });
    }
    return result(attempt, attempt.reference?.transcript ?? attempt.referenceSnapshot);
  }
}

function result(attempt: TypingAttempt, reference: string | null) {
  return NextResponse.json({
    attemptId: attempt.id,
    reference,
    completed: attempt.completed,
    score: {
      accuracy: attempt.accuracy,
      completion: attempt.completion,
      netWpm: attempt.wpm,
      rawWpm: attempt.rawWpm,
      scored: true,
      words: {
        correct: attempt.wordsCorrect,
        incorrect: attempt.wordsIncorrect,
        missed: attempt.wordsMissed,
        extra: attempt.wordsExtra,
        total: attempt.wordsTotal,
      },
      punctuation: {
        correct: attempt.punctuationCorrect,
        incorrect: attempt.punctuationIncorrect,
        missed: attempt.punctuationMissed,
        extra: attempt.punctuationExtra,
        total: attempt.punctuationTotal,
      },
    },
  });
}

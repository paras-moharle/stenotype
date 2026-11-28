import { lockStudentAccount } from '@/lib/student-account-lock';
import { dictationReferenceDigest, verifyPracticeTicket } from '@/lib/dictation-practice-ticket';
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
import { scheduleDatabaseMaintenance } from '@/lib/schedule-database-maintenance';
import type { TypingAttempt } from '@/generated/prisma/client';

export async function POST(request: Request) {
  const rejection = rejectCrossOriginMutation(request);
  if (rejection) return rejection;

  const gate = await requireStudent();
  if (!gate.ok) return gate.response;
  scheduleDatabaseMaintenance();

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

  const { typed, elapsedMs, passageId, submissionKey, practiceTicket } = parsed.data;
  const key = { studentId_submissionKey: { studentId: gate.profileId, submissionKey } };

  const prior = await db.typingAttempt.findUnique({ where: key, include: { reference: true } });
  if (!prior && !limit.allowed) return throttled();
  const ticket = verifyPracticeTicket(practiceTicket, { profileId: gate.profileId, passageId, submissionKey });
  if (!ticket || ticket.expiresAt <= Date.now()) return unavailablePractice();
  if (prior) return replay(prior, ticket.digest);
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

  const publication = ticket.publishedAt ? new Date(ticket.publishedAt) : null;
  const dictation = await db.dictation.findFirst({
    where: { id: passageId, status: 'PUBLISHED', publishedAt: publication, youtubeId: ticket.youtubeId },
    select: { referenceTranscript: true },
  });
  if (!dictation) return unavailablePractice();

  const digest = ticket.digest;
  const transcript = dictationReferenceDigest(dictation.referenceTranscript) === digest
    ? dictation.referenceTranscript
    : (await db.dictationReference.findUnique({ where: { digest }, select: { transcript: true } }))?.transcript;
  if (!transcript || dictationReferenceDigest(transcript) !== digest) return unavailablePractice();

  let score;
  try {
    score = scoreFromAlignment(align(transcript, typed), elapsedMs);
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

  const attempt = await db.$transaction(async (tx) => {
    const student = await lockStudentAccount(tx, gate.userId);
    const eligible = student && !student.banned && await tx.studentProfile.findFirst({
      where: { id: gate.profileId, userId: gate.userId, status: 'ACTIVE', user: {
        sessions: { some: { id: gate.sessionId, expiresAt: { gt: new Date() } } },
      } },
      select: { id: true },
    });
    if (!eligible) return 'session-ended' as const;
    if (ticket.expiresAt <= Date.now()) return null;
    const pair = { studentId_dictationId: { studentId: gate.profileId, dictationId: passageId } };
    const current = await tx.typingAttempt.findUnique({
      where: pair, select: { id: true, submissionKey: true, practiceExpiresAt: true },
    });
    if (current?.submissionKey === submissionKey) {
      return tx.typingAttempt.findUnique({ where: pair, include: { reference: { select: { transcript: true } } } });
    }
    const currentExpiry = current?.practiceExpiresAt?.getTime();
    if (currentExpiry !== undefined && currentExpiry >= ticket.expiresAt) return 'superseded' as const;

    // Score outside the transaction. At persistence, lock only the current
    // publication row so an archive, unpublish or delete cannot race the write.
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Dictation"
      WHERE "id" = ${passageId} AND "status" = 'PUBLISHED'
        AND "publishedAt" IS NOT DISTINCT FROM ${publication}::timestamptz
        AND "youtubeId" IS NOT DISTINCT FROM ${ticket.youtubeId}::text
      FOR SHARE
    `;
    if (rows.length === 0) return null;

    await tx.dictationReference.createMany({
      data: { digest, transcript },
      skipDuplicates: true,
    });
    const saved = {
      submissionKey,
      practiceExpiresAt: new Date(ticket.expiresAt),
      referenceDigest: digest,
      referenceSnapshot: null,
      scoreVersion: 1,
      typedText: typed,
      elapsedMs,
      rawWpm: score.rawWpm,
      wpm: score.netWpm,
      accuracy: score.accuracy,
      completed: score.completion >= 100,
      ...attemptSnapshot(score),
      createdAt: new Date(),
    };
    if (current) {
      return tx.typingAttempt.update({
        where: { id: current.id }, data: saved, include: { reference: { select: { transcript: true } } },
      });
    }
    return tx.typingAttempt.create({
      data: { ...saved, studentId: gate.profileId, dictationId: passageId },
      include: { reference: { select: { transcript: true } } },
    });
  });
  if (attempt === 'session-ended') {
    return NextResponse.json({ error: 'Student access ended before the result could be saved.' }, { status: 403 });
  }
  if (attempt === 'superseded') {
    return NextResponse.json({
      code: 'PRACTICE_SUPERSEDED',
      error: 'A newer practice has a saved result. This transcription was not saved.',
    }, { status: 409 });
  }
  return attempt ? replay(attempt, digest) : unavailablePractice();

  function replay(attempt: TypingAttempt & { reference: { transcript: string } | null }, digest: string) {
    if (attempt.referenceDigest !== digest || attempt.dictationId !== passageId || attempt.typedText !== typed || attempt.elapsedMs !== elapsedMs) {
      return NextResponse.json({ error: 'This submission key belongs to a different attempt.' }, { status: 409 });
    }
    return result(attempt, attempt.reference?.transcript ?? attempt.referenceSnapshot);
  }
}

function unavailablePractice() {
  return NextResponse.json({
    code: 'PRACTICE_UNAVAILABLE',
    error: 'This dictation revision is unavailable for evaluation. Your transcription is still here.',
  }, { status: 409 });
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

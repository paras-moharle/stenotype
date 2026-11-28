import { rejectStorageGrowth } from '@/lib/db-capacity';
import { readJson } from '@/lib/mutation-request';
import { NextResponse } from 'next/server';
import { dictationReferenceDigest } from '@/lib/dictation-practice-ticket';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';
import { publicationTranscriptError, updateDictationSchema } from '@/lib/admin/schemas';
import { nextRecordingDuration } from '@/lib/admin/recording';
import { nextPublishedAt } from '@/lib/admin/publish';
import { isForeignKeyError, isNotFoundError } from '@/lib/prisma-errors';

/**
 * PUT /api/admin/dictations/[id]
 * DELETE /api/admin/dictations/[id]
 *
 * Admin-only: update or delete a dictation.
 */

const NOT_FOUND = { error: 'Dictation not found' };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const dictation = await db.dictation.findUnique({
    where: { id },
    select: { id: true, title: true, category: true, referenceTranscript: true, youtubeId: true, status: true, updatedAt: true },
  });
  return dictation
    ? NextResponse.json({ dictation })
    : NextResponse.json(NOT_FOUND, { status: 404 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await readJson(request, 320_000);
  if (!body.ok) return body.response;
  const parsed = updateDictationSchema.safeParse(body.data);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const existing = await db.dictation.findUnique({
    where: { id },
    select: { id: true, publishedAt: true, referenceTranscript: true, status: true, updatedAt: true, youtubeId: true },
  });
  if (!existing) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const { title, category, referenceTranscript, youtubeId, durationSeconds, status, expectedUpdatedAt } =
    parsed.data;

  if (expectedUpdatedAt && existing.updatedAt.toISOString() !== expectedUpdatedAt) {
    return NextResponse.json({ error: 'Dictation changed since you opened it. Reopen the current version before saving.' }, { status: 409 });
  }
  const nextDuration = nextRecordingDuration(existing.youtubeId, youtubeId, durationSeconds);

  if ((status ?? existing.status) === 'PUBLISHED') {
    const error = publicationTranscriptError(referenceTranscript ?? existing.referenceTranscript);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }

  const growsText = referenceTranscript !== undefined && referenceTranscript !== existing.referenceTranscript;
  if (growsText) {
    const capacity = await rejectStorageGrowth();
    if (capacity) return capacity;
  }

  // The compare-and-swap must advance even if two edits land in one millisecond.
  const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
  const previousPublication = existing.status === 'ARCHIVED' && status === 'PUBLISHED' ? null : existing.publishedAt;
  try {
    const dictation = await db.$transaction(async (tx) => {
      const updated = await tx.dictation.update({
        where: { id, updatedAt: existing.updatedAt },
        data: {
          updatedAt,
          ...(title !== undefined ? { title } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(referenceTranscript !== undefined ? { referenceTranscript } : {}),
          ...(youtubeId !== undefined ? { youtubeId } : {}),
          ...(nextDuration !== undefined ? { durationSeconds: nextDuration } : {}),
          ...(status !== undefined ? { status } : {}),
          // Editing a published dictation keeps its original publish date;
          // publishing a draft stamps one; moving to draft clears it.
          ...(status !== undefined
            ? { publishedAt: nextPublishedAt(previousPublication, status, updatedAt) }
            : {}),
        },
      });
      if (growsText && existing.status === 'PUBLISHED') {
        await tx.dictationReference.createMany({
          data: { digest: dictationReferenceDigest(existing.referenceTranscript), transcript: existing.referenceTranscript },
          skipDuplicates: true,
        });
      }
      return updated;
    });

    return NextResponse.json({ dictation });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Dictation changed. Reload before saving again.' }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const { id } = await params;

  const existing = await db.dictation.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  // Results are the only reason a dictation cannot be hard-deleted:
  // removing it would orphan student history. Archive it instead.
  const results = await db.typingAttempt.count({
    where: { dictationId: id },
  });
  if (results > 0) {
    return NextResponse.json(
      {
        error: `This dictation has ${results} saved result${results === 1 ? '' : 's'}. Archive it instead of deleting — deleting would orphan student history.`,
      },
      { status: 409 }
    );
  }

  try {
    await db.dictation.delete({ where: { id } });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    if (isForeignKeyError(error)) {
      return NextResponse.json(
        { error: 'This dictation is still referenced and cannot be deleted.' },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}

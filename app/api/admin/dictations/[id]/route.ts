import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';
import { updateDictationSchema } from '@/lib/admin/schemas';
import { nextPublishedAt } from '@/lib/admin/publish';
import { isForeignKeyError, isNotFoundError } from '@/lib/prisma-errors';

/**
 * PUT /api/admin/dictations/[id]
 * DELETE /api/admin/dictations/[id]
 *
 * Admin-only: update or delete a dictation.
 */

const NOT_FOUND = { error: 'Dictation not found' };

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateDictationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const existing = await db.dictation.findUnique({
    where: { id },
    select: { id: true, publishedAt: true },
  });
  if (!existing) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const { title, category, referenceTranscript, youtubeId, durationSeconds, status } =
    parsed.data;

  try {
    const dictation = await db.dictation.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(referenceTranscript !== undefined ? { referenceTranscript } : {}),
        ...(youtubeId !== undefined ? { youtubeId } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
        ...(status !== undefined ? { status } : {}),
        // Editing a published dictation keeps its original publish date;
        // publishing a draft stamps one; moving to draft clears it.
        ...(status !== undefined
          ? { publishedAt: nextPublishedAt(existing.publishedAt, status) }
          : {}),
      },
    });

    return NextResponse.json({ dictation });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
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

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * PUT /api/admin/dictations/[id]
 * DELETE /api/admin/dictations/[id]
 *
 * Admin-only: update or delete a dictation.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { title, category, referenceTranscript, youtubeId, durationSeconds, status } = body ?? {};

  const dictation = await db.dictation.update({
    where: { id },
    data: {
      title: title ?? undefined,
      category: category ?? undefined,
      referenceTranscript: referenceTranscript ?? undefined,
      youtubeId: youtubeId !== undefined ? youtubeId : undefined,
      durationSeconds: durationSeconds !== undefined ? durationSeconds : undefined,
      status: status ?? undefined,
      publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
    },
  });

  return NextResponse.json({ dictation });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await db.dictation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}


import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { db } from '@/lib/db';

const createDictationSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.enum(['GENERAL', 'PROFESSIONAL', 'LEGAL']),
  referenceTranscript: z.string().min(1).max(50000),
  youtubeId: z.string().max(20).optional(),
  durationSeconds: z.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

/**
 * GET /api/admin/dictations
 * POST /api/admin/dictations
 *
 * Admin-only: list all dictations (including drafts) or create new.
 */
export async function GET() {
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

  const dictations = await db.dictation.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ dictations });
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const parsed = createDictationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { title, category, referenceTranscript, youtubeId, durationSeconds, status } = parsed.data;

  const dictation = await db.dictation.create({
    data: {
      title,
      category,
      referenceTranscript,
      youtubeId: youtubeId ?? null,
      durationSeconds: durationSeconds ?? null,
      status: status ?? 'DRAFT',
      createdById: session.user.id,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    },
  });

  return NextResponse.json({ dictation }, { status: 201 });
}


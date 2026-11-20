import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createDictationSchema } from '@/lib/admin/schemas';
import { nextPublishedAt } from '@/lib/admin/publish';

/**
 * GET /api/admin/dictations
 * POST /api/admin/dictations
 *
 * Admin-only: list all dictations (including drafts) or create new.
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const dictations = await db.dictation.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ dictations });
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => null);
  const parsed = createDictationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { title, category, referenceTranscript, youtubeId, durationSeconds } =
    parsed.data;
  const status = parsed.data.status ?? 'DRAFT';

  const dictation = await db.dictation.create({
    data: {
      title,
      category,
      referenceTranscript,
      // A blank YouTube field is valid and means "no video".
      youtubeId: youtubeId ?? null,
      durationSeconds: durationSeconds ?? null,
      status,
      createdById: gate.userId,
      publishedAt: nextPublishedAt(null, status),
    },
  });

  return NextResponse.json({ dictation }, { status: 201 });
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/api-guard';

/**
 * GET /api/dictations
 *
 * Returns published dictations WITHOUT transcripts.
 * Students see titles, categories, and YouTube links — never
 * the reference text. Transcripts are only accessed server-side
 * during scoring (POST /api/attempts).
 */
export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const dictations = await db.dictation.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      title: true,
      category: true,
      youtubeId: true,
      durationSeconds: true,
      // NOTE: referenceTranscript is intentionally excluded.
      // Students must not see the transcript before completing.
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ dictations });
}


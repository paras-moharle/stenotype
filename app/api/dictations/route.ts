import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/dictations
 *
 * Returns published dictations WITHOUT transcripts.
 * Students see titles, categories, and YouTube links — never
 * the reference text. Transcripts are only accessed server-side
 * during scoring (POST /api/attempts).
 */
export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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


import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/dictations/[id]/transcript
 *
 * Returns the full transcript for a dictation.
 * Students can view the transcript before practicing (for reference).
 * The transcript is NOT sent during blind typing — only via this
 * explicit endpoint when the student clicks "View Text".
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const dictation = await db.dictation.findUnique({
    where: { id },
    select: {
      referenceTranscript: true,
      status: true,
    },
  });

  if (!dictation || dictation.status !== 'PUBLISHED') {
    return NextResponse.json(
      { error: 'Dictation not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    transcript: dictation.referenceTranscript,
  });
}


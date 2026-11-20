import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';

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
  // Admin-only: a student must not be able to read the dictation text
  // before practising. They receive it from POST /api/attempts after the
  // attempt has been scored (for the review).
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

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


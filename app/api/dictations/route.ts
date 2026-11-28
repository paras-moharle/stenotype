import { dictationReferenceDigest, issuePracticeTicket } from '@/lib/dictation-practice-ticket';
import { db } from '@/lib/db';
import { requireStudent } from '@/lib/api-guard';
import { catalogFields, validDictationId } from '@/lib/dictation-catalog';

export async function GET(request: Request) {
  const gate = await requireStudent();
  if (!gate.ok) return gate.response;

  // The transcript stays server-side. The signed ticket pins the revision.
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !validDictationId(id)) {
    return Response.json({ error: 'Select a dictation from the library.' }, { status: 400 });
  }
  const dictation = await db.dictation.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: { ...catalogFields, referenceTranscript: true, publishedAt: true },
  });
  if (!dictation) return Response.json({ error: 'Dictation is unavailable.' }, { status: 404 });
  const { referenceTranscript, publishedAt, ...metadata } = dictation;
  const practice = issuePracticeTicket({
    profileId: gate.profileId, passageId: id, digest: dictationReferenceDigest(referenceTranscript),
    youtubeId: metadata.youtubeId, publishedAt: publishedAt?.toISOString() ?? null,
  });
  return Response.json({ dictation: metadata, practice }, { headers: { 'Cache-Control': 'private, no-store' } });
}

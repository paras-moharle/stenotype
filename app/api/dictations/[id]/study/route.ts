import { requireStudent } from '@/lib/api-guard';
import { db } from '@/lib/db';
import { catalogFields, validDictationId } from '@/lib/dictation-catalog';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStudent();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const item = validDictationId(id) ? await db.dictation.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: { ...catalogFields, referenceTranscript: true },
  }) : null;
  if (!item) return Response.json({ error: 'Dictation is unavailable.' }, { status: 404 });
  const { referenceTranscript: transcript, ...dictation } = item;
  return Response.json({ transcript, dictation }, { headers: { 'Cache-Control': 'private, no-store' } });
}

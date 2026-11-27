import { db } from '@/lib/db';
import { requireStudent } from '@/lib/api-guard';
import { catalogFields, validDictationId } from '@/lib/dictation-catalog';

export async function GET(request: Request) {
  const gate = await requireStudent();
  if (!gate.ok) return gate.response;

  // Practice requests only the selected exercise's public metadata.
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !validDictationId(id)) {
    return Response.json({ error: 'Select a dictation from the library.' }, { status: 400 });
  }
  const dictation = await db.dictation.findFirst({
    where: { id, status: 'PUBLISHED' },
    select: catalogFields,
  });
  if (!dictation) return Response.json({ error: 'Dictation is unavailable.' }, { status: 404 });
  return Response.json({ dictation }, { headers: { 'Cache-Control': 'private, no-store' } });
}

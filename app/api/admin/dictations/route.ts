import { createHash, randomUUID } from 'node:crypto';
import { rejectStorageGrowth } from '@/lib/db-capacity';
import { readJson } from '@/lib/mutation-request';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createDictationSchema } from '@/lib/admin/schemas';
import { nextPublishedAt } from '@/lib/admin/publish';
import { listAdminDictations } from '@/lib/admin/list-dictations';

/**
 * GET /api/admin/dictations?limit=100&offset=0
 * POST /api/admin/dictations
 *
 * Admin-only: list all dictations (including drafts), paged and capped
 * at 200, or create a new one.
 */
export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  return NextResponse.json(await listAdminDictations(new URL(request.url).searchParams));
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const body = await readJson(request, 320_000);
  if (!body.ok) return body.response;
  const parsed = createDictationSchema.safeParse(body.data);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { title, category, referenceTranscript, youtubeId, durationSeconds } =
    parsed.data;
  const status = parsed.data.status ?? 'DRAFT';

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey || !/^(?:[0-9a-f]{36}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.test(idempotencyKey)) {
    return NextResponse.json({ error: 'Reload the admin workspace to obtain a valid creation key.' }, { status: 400 });
  }

  const data = {
    title, category, referenceTranscript, youtubeId: youtubeId ?? null,
    durationSeconds: youtubeId ? durationSeconds ?? null : null,
    status, createdById: gate.userId,
  };
  const digest = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const receiptId = 'stenotype:dictation:create:' + createHash('sha256')
    .update(JSON.stringify([gate.userId, idempotencyKey.toLowerCase()])).digest('hex');
  const reply = (value: string) => value.startsWith(digest + ':')
    ? NextResponse.json({ dictation: { id: value.slice(digest.length + 1) } }, { status: 201 })
    : NextResponse.json({ error: 'This creation key already belongs to a different dictation.' }, { status: 409 });

  const receipt = await db.verification.findUnique({ where: { id: receiptId }, select: { value: true } });
  if (receipt) return reply(receipt.value);
  const capacity = await rejectStorageGrowth();
  if (capacity) return capacity;

  const value = await db.$transaction(async tx => {
    const dictationId = randomUUID();
    const receiptValue = digest + ':' + dictationId;
    // App-owned permanent receipt, isolated from Better Auth identifiers.
    const inserted = await tx.verification.createMany({
      data: {
        id: receiptId, identifier: receiptId, value: receiptValue,
        expiresAt: new Date('9999-01-01T00:00:00.000Z'),
      },
      skipDuplicates: true,
    });
    if (!inserted.count) {
      return (await tx.verification.findUniqueOrThrow({ where: { id: receiptId }, select: { value: true } })).value;
    }
    await tx.dictation.create({
      data: { ...data, id: dictationId, publishedAt: nextPublishedAt(null, status) },
    });
    return receiptValue;
  });
  return reply(value);
}

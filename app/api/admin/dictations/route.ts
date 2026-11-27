import { rejectStorageGrowth } from '@/lib/db-capacity';
import { readJson } from '@/lib/mutation-request';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createDictationSchema } from '@/lib/admin/schemas';
import { nextPublishedAt } from '@/lib/admin/publish';
import { pageSlice, parsePageParams } from '@/lib/pagination';

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

  const page = parsePageParams(request);
  const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 200);
  const categories = (['GENERAL', 'PROFESSIONAL', 'LEGAL'] as const)
    .filter((category) => query && category.toLowerCase().includes(query.toLowerCase()));

  const rows = await db.dictation.findMany({
    where: query ? { OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { category: { in: categories } },
    ] } : undefined,
    select: { id: true, title: true, category: true, status: true, youtubeId: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.take + 1,
    skip: page.skip,
  });

  const dictations = pageSlice(rows, page);

  return NextResponse.json({
    dictations,
    page: { limit: page.limit, offset: page.offset, hasMore: page.hasMore(rows) },
  });
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

  const capacity = await rejectStorageGrowth();
  if (capacity) return capacity;

  const dictation = await db.dictation.create({
    data: {
      title,
      category,
      referenceTranscript,
      // A blank YouTube field is valid and means "no video".
      youtubeId: youtubeId ?? null,
      durationSeconds: youtubeId ? durationSeconds ?? null : null,
      status,
      createdById: gate.userId,
      publishedAt: nextPublishedAt(null, status),
    },
  });

  return NextResponse.json({ dictation }, { status: 201 });
}

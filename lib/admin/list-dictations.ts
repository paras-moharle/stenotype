import { db } from '@/lib/db';
import { pageSlice, parsePageParams } from '@/lib/pagination';

export async function listAdminDictations(params: URLSearchParams) {
  const page = parsePageParams(params);
  const query = params.get('q')?.trim().slice(0, 200);
  const status = params.get('status');
  const category = params.get('category');
  const categories = (['GENERAL', 'PROFESSIONAL', 'LEGAL'] as const)
    .filter((category) => query && category.toLowerCase().includes(query.toLowerCase()));

  const rows = await db.dictation.findMany({
    where: {
      ...(status === 'DRAFT' || status === 'PUBLISHED' || status === 'ARCHIVED' ? { status } : {}),
      ...(category === 'LEGAL' || category === 'GENERAL' || category === 'PROFESSIONAL' ? { category } : {}),
      ...(query ? { OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { category: { in: categories } },
      ] } : {}),
    },
    select: { id: true, title: true, category: true, status: true, youtubeId: true, createdAt: true, updatedAt: true, _count: { select: { typingAttempts: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.take + 1,
    skip: page.skip,
  });

  const dictations = pageSlice(rows, page);

  return {
    dictations: dictations.map(dictation => ({
      ...dictation,
      createdAt: dictation.createdAt.toISOString(),
      updatedAt: dictation.updatedAt.toISOString(),
    })),
    page: { limit: page.limit, offset: page.offset, hasMore: page.hasMore(rows) },
  };
}

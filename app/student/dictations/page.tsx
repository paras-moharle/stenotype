import { DictationFilters } from '@/components/student/dictation-filters';
import Link from 'next/link';
import { BarChart3, Keyboard, Youtube } from 'lucide-react';
import { db } from '@/lib/db';
import { requireStudentPage } from '@/lib/student-session';
import { catalogCategories, catalogFields, dictationMetadata } from '@/lib/dictation-catalog';
import { parsePageNumber } from '@/lib/pagination';
import { youtubeWatchUrl } from '@/lib/youtube';
import { StudentHeader } from '@/components/student/student-header';
import { DictationStudy } from '@/components/student/dictation-study';
import { Button } from '@/components/ui/button';
import { ResultsPagination } from '@/components/ui/results-pagination';

const PAGE_SIZE = 24;

export default async function StudentDictationsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string; page?: string }>;
}) {
  await requireStudentPage();
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 120) : '';
  const category = catalogCategories.find(value => value === params.category);
  const sort = params.sort === 'title' ? 'title' : 'newest';
  const page = parsePageNumber(params.page);
  const filters = { q, category: category ?? '', sort };
  const library = `/student/dictations?${new URLSearchParams({ ...filters, page: String(page) })}`;
  const rows = await db.dictation.findMany({
    where: { status: 'PUBLISHED', category, ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}) },
    select: catalogFields,
    orderBy: [sort === 'title' ? { title: 'asc' } : { publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    skip: (page - 1) * PAGE_SIZE,
  });

  return <div className="space-y-5">
    <StudentHeader title="Dictation library" description="Read a transcript for study, or open YouTube and transcribe in the Typing tab." />
    <DictationFilters {...filters} />
    {rows.length === 0 ? <div className="panel space-y-2 p-5">
      <p>{q || category ? 'No dictations match these filters.' : page > 1 ? 'No dictations on this page.' : 'No published dictations yet.'}</p>
      {(q || category || page > 1) && <Link className="text-brand underline" href="/student/dictations">Reset filters and page</Link>}
    </div> : <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {rows.slice(0, PAGE_SIZE).map(item => {
        const video = youtubeWatchUrl(item.youtubeId);
        const practiceHref = `/student/typing?${new URLSearchParams({ mode: 'dictation', dictationId: item.id, from: library })}`;
        return <li key={item.id} className="grid items-center gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0"><h2 className="break-words font-semibold">{item.title}</h2><p className="text-sm text-muted-foreground">{dictationMetadata(item)}</p></div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button asChild variant="outline" className="h-11 gap-2 px-2 sm:px-4"><Link prefetch={false} href={`/student/results?dictationId=${encodeURIComponent(item.id)}`}><BarChart3 size={16} aria-hidden /> Result</Link></Button>
            {video ? <Button asChild variant="outline" className="h-11 gap-2 px-2 sm:px-4"><a href={video} target="_blank" rel="noopener noreferrer" aria-label="YouTube (opens in a new tab)"><Youtube size={16} aria-hidden /> YouTube</a></Button>
              : <Button variant="outline" disabled className="h-11 gap-2 px-2 sm:px-4"><Youtube size={16} aria-hidden /> No video</Button>}
            <DictationStudy item={item} practiceHref={practiceHref} />
            <Button asChild className="h-11 gap-2 px-2 sm:px-4"><Link prefetch={false} href={practiceHref}><Keyboard size={16} aria-hidden /> Practice</Link></Button>
          </div>
        </li>;
      })}
    </ul>}
    <ResultsPagination label="Dictation library pages" path="/student/dictations" page={page} hasMore={rows.length > PAGE_SIZE} filters={filters} />
  </div>;
}

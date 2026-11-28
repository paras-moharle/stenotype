import type { Prisma } from '@/generated/prisma/client';
import Link from 'next/link';
import { AdminResultsFilter } from '@/components/admin/admin-results-filter';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { ResultsPagination } from '@/components/ui/results-pagination';
import { parsePageNumber } from '@/lib/pagination';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { dictationAttemptsWhere } from '@/lib/dictation-history';
import { formatISTDateTime } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

type Attempt = {
  id: string;
  wpm: number;
  accuracy: number;
  completion: number;
  wordsCorrect: number;
  wordsIncorrect: number;
  wordsExtra: number;
  wordsMissed: number;
  wordsTotal: number;
  punctuationCorrect: number;
  punctuationIncorrect: number;
  punctuationExtra: number;
  punctuationMissed: number;
  punctuationTotal: number;
  completed: boolean;
  createdAt: Date;
  dictation: { title: string; category: string };
  student: {
    user: {
      name: string;
      email: string;
    };
  };
};

const PAGE_SIZE = 25;

export default async function AdminResultsPage({
  searchParams,
}: { searchParams: Promise<{ page?: string | string[]; q?: string | string[]; completed?: string | string[]; student?: string | string[] }> }) {
  await requireAdminPage();
  const { page: pageParam, q, completed, student } = await searchParams;
  const page = parsePageNumber(pageParam);
  const query = typeof q === 'string' ? q.trim().slice(0, 120) : '';
  const studentId = typeof student === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(student) ? student : undefined;
  const completion = completed === 'yes' || completed === 'no' ? completed : '';

  const attemptWhere: Prisma.TypingAttemptWhereInput = {
      ...dictationAttemptsWhere,
      ...(studentId ? { studentId } : {}),
      ...(completion && { completed: completion === 'yes' }),
      ...(query && { OR: [
        { dictation: { title: { contains: query, mode: 'insensitive' } } },
        { student: { user: { name: { contains: query, mode: 'insensitive' } } } },
        { student: { user: { email: { contains: query, mode: 'insensitive' } } } },
      ] }),
  };
  const rows = await db.typingAttempt.findMany({
    where: attemptWhere,
    take: PAGE_SIZE + 1,
    skip: (page - 1) * PAGE_SIZE,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    // Only the columns the table renders — `typedText` is excluded.
    select: {
      id: true,
      wpm: true,
      accuracy: true,
      completion: true,
      wordsCorrect: true,
      wordsIncorrect: true,
      wordsExtra: true,
      wordsMissed: true,
      wordsTotal: true,
      punctuationCorrect: true,
      punctuationIncorrect: true,
      punctuationExtra: true,
      punctuationMissed: true,
      punctuationTotal: true,
      completed: true,
      createdAt: true,
      dictation: { select: { title: true, category: true } },
      student: {
        select: {
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!rows.length && page > 1) {
    const count = await db.typingAttempt.count({ where: attemptWhere });
    const params = new URLSearchParams({ page: String(Math.max(1, Math.ceil(count / PAGE_SIZE))) });
    if (studentId) params.set('student', studentId);
    if (query) params.set('q', query);
    if (completion) params.set('completed', completion);
    redirect('/admin/results?' + params);
  }
  const attempts = rows.slice(0, PAGE_SIZE);
  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (a: Attempt) => (
        <div>
          <div className="font-medium">{a.student.user.name}</div>
          <div className="text-sm text-muted-foreground">
            {a.student.user.email}
          </div>
        </div>
      ),
    },
    {
      key: 'dictation',
      header: 'Dictation',
      render: (a: Attempt) => (
        <div>
          <Link prefetch={false} href={`/admin/results/${a.id}`} className="font-medium underline-offset-4 hover:underline">{a.dictation?.title ?? 'Dictation result'}</Link>
          <div className="text-xs text-muted-foreground">
            {a.dictation?.category ?? ''}
          </div>
        </div>
      ),
    },
    {
      key: 'wpm',
      header: 'Net WPM',
      render: (a: Attempt) => a.wpm,
    },
    {
      key: 'accuracy',
      header: 'Attempted accuracy',
      render: (a: Attempt) => `${a.accuracy}%`,
    },
    {
      key: 'words',
      header: 'Words',
      render: (a: Attempt) => (
        <span
          title={`wrong ${a.wordsIncorrect} · missed ${a.wordsMissed} · extra ${a.wordsExtra}`}
        >
          {a.wordsCorrect}/{a.wordsTotal}
        </span>
      ),
    },
    {
      key: 'punctuation',
      header: 'Punct.',
      render: (a: Attempt) => (
        <span
          title={`wrong ${a.punctuationIncorrect} · missed ${a.punctuationMissed} · extra ${a.punctuationExtra}`}
        >
          {a.punctuationCorrect}/{a.punctuationTotal}
        </span>
      ),
    },
    {
      key: 'completion',
      header: 'Passage covered',
      render: (a: Attempt) => `${a.completion}%`,
    },
    {
      key: 'completed',
      header: 'Fully covered',
      render: (a: Attempt) => (a.completed ? 'Yes' : 'No'),
    },
    {
      key: 'date',
      header: 'Date',
      render: (a: Attempt) =>
        formatISTDateTime(a.createdAt),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Results"
        description="Current saved dictation results"
      />

      <AdminResultsFilter query={query} completion={completion} studentId={studentId} />

      {attempts.length === 0 ? (
        <div className="rounded-2xl border border-border/70 p-8 text-center text-muted-foreground">
          {query || completion || page > 1 ? 'No results match this view.' : 'Results will appear after students complete a dictation.'}
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={attempts}
          rowKey={(a) => a.id}
        />
      )}
      <ResultsPagination path="/admin/results" page={page} filters={{ q: query, completed: completion, student: studentId ?? '' }} hasMore={rows.length > PAGE_SIZE} />
    </div>
  );
}


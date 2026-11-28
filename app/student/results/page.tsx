import { validDictationId } from '@/lib/dictation-catalog';
import Link from 'next/link';
import { formatISTDateTime } from '@/lib/datetime';
import { StudentHeader } from '@/components/student/student-header';

import { db } from '@/lib/db';
import { dictationAttemptsWhere, dictationAttemptStats, dictationHistorySelect } from '@/lib/dictation-history';
import { requireStudentPage } from '@/lib/student-session';
import { parsePageNumber } from '@/lib/pagination';
import { ResultsPagination } from '@/components/ui/results-pagination';

const PAGE_SIZE = 50;

export default async function StudentResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; dictationId?: string }>;
}) {
  const { profile } = await requireStudentPage();
  const params = await searchParams;
  const page = parsePageNumber(params.page);
  const dictationId = typeof params.dictationId === 'string' && validDictationId(params.dictationId) ? params.dictationId : undefined;
  const [rows, stats] = await Promise.all([
    db.typingAttempt.findMany({
      where: { ...dictationAttemptsWhere, studentId: profile.id, ...(dictationId ? { dictationId } : {}) },
      select: dictationHistorySelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
      skip: (page - 1) * PAGE_SIZE,
    }),
    dictationId ? null : dictationAttemptStats(profile.id),
  ]);
  const attempts = rows.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-8">
      <StudentHeader
        title="My results"
        description="Saved dictation scores and historical transcription reviews."
      />

      {dictationId && <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>{attempts[0]?.dictation?.title ?? 'Selected dictation'}</span>
        <Link href="/student/results" className="text-brand underline">All results</Link>
        <Link href="/student/dictations" className="text-brand underline">Dictation library</Link>
      </div>}
      {attempts.length === 0 ? (
        <div className="card-sheen rounded-3xl border border-dashed border-border bg-surface/30 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            {page === 1 && dictationId ? 'You have no saved attempts for this dictation.' : page === 1 ? 'Complete a dictation to see your scores here.' : 'No results on this page.'}
          </p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          {stats && stats.totalAttempts > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="stat card-sheen p-4">
                <div className="stat-value text-brand">{stats.totalAttempts}</div>
                <div className="text-sm text-muted-foreground">
                  All attempts
                </div>
              </div>
              <div className="stat card-sheen p-4">
                <div className="stat-value text-brand">{stats.avgWpm}</div>
                <div className="text-sm text-muted-foreground">Avg net WPM</div>
              </div>
              <div className="stat card-sheen p-4">
                <div className="stat-value text-brand">{stats.avgAccuracy}%</div>
                <div className="text-sm text-muted-foreground">Avg attempted accuracy</div>
              </div>
              <div className="stat card-sheen p-4">
                <div className="stat-value text-brand">{stats.bestWpm}</div>
                <div className="text-sm text-muted-foreground">Best net WPM</div>
              </div>
            </div>
          )}

          <ul className="divide-y divide-border rounded-xl border border-border bg-surface md:hidden">
            {attempts.map((attempt) => (
              <li key={attempt.id}>
                <Link prefetch={false} href={`/student/results/${attempt.id}`} className="block p-4 hover:bg-accent">
                  <span className="block font-semibold">{attempt.dictation?.title ?? 'Dictation result'}</span>
                  <span className="block text-sm text-muted-foreground">{formatISTDateTime(attempt.createdAt)}</span>
                  <span className="mt-2 block text-sm">{attempt.wpm} net WPM · {attempt.accuracy}% attempted accuracy · {attempt.completion}% complete</span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Attempts table */}
          <div className="table-wrap hidden md:block" role="region" aria-label="Saved dictation results" tabIndex={0}>
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head border-b border-border">
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Dictation</th>
                  <th className="px-4 py-3 text-left font-medium">Net WPM</th>
                  <th className="px-4 py-3 text-left font-medium">Attempted accuracy</th>
                  <th className="px-4 py-3 text-left font-medium">Words</th>
                  <th className="px-4 py-3 text-left font-medium">Punct.</th>
                  <th className="px-4 py-3 text-left font-medium">Passage covered</th>
                  <th className="px-4 py-3 text-left font-medium">Fully covered</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr
                    key={attempt.id}
                    className="table-row"
                  >
                    <td className="px-4 py-3">
                      {formatISTDateTime(attempt.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link prefetch={false} href={`/student/results/${attempt.id}`} className="font-medium text-brand underline-offset-4 hover:underline">{attempt.dictation?.title ?? 'Dictation result'}</Link>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {attempt.dictation?.category ?? ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold tabular-nums text-foreground">{attempt.wpm}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{attempt.accuracy}%</td>
                    <td
                      className="px-4 py-3 text-success"
                      title={`wrong ${attempt.wordsIncorrect} · missed ${attempt.wordsMissed} · extra ${attempt.wordsExtra}`}
                    >
                      {attempt.wordsCorrect}/{attempt.wordsTotal}
                    </td>
                    <td
                      className="px-4 py-3"
                      title={`wrong ${attempt.punctuationIncorrect} · missed ${attempt.punctuationMissed} · extra ${attempt.punctuationExtra}`}
                    >
                      {attempt.punctuationCorrect}/{attempt.punctuationTotal}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{attempt.completion}%</td>
                    <td className="px-4 py-3">
                      <span className="badge badge-neutral">
                        {attempt.completed ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Only dictation attempts are saved. Free practice and custom text
            stay on your device.
          </p>
        </>
      )}
      <ResultsPagination path="/student/results" page={page} hasMore={rows.length > PAGE_SIZE} filters={dictationId ? { dictationId } : undefined} />
    </div>
  );
}


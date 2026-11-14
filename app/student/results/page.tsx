'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StudentHeader } from '@/components/student/student-header';
import { BarChart3, ArrowRight, RotateCcw } from 'lucide-react';
import {
  clearSessionResults,
  getSessionResults,
  subscribeSessionResults,
  SESSION_RESULT_LIMIT,
  type SessionResult,
} from '@/lib/session-results';

export default function StudentResultsPage() {
  const [results, setResults] = useState<SessionResult[]>([]);

  useEffect(() => {
    const sync = () => setResults(getSessionResults());
    sync();
    return subscribeSessionResults(sync);
  }, []);

  const total = results.length;
  const avgWpm = total
    ? Math.round(results.reduce((s, r) => s + r.wpm, 0) / total)
    : 0;
  const avgAccuracy = total
    ? Math.round(results.reduce((s, r) => s + r.accuracy, 0) / total)
    : 0;
  const best = total
    ? results.reduce((a, r) => (r.wpm > a.wpm ? r : a), results[0])
    : null;

  return (
    <div className="space-y-10">
      <StudentHeader
        title="My results"
        description="Results for your current visit. These are not saved."
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800 font-medium">
          🚧 Session-only results — not stored.
        </p>
        <p className="mt-1 text-xs text-amber-700">
          You can finish up to {SESSION_RESULT_LIMIT} tests without refreshing
          and they will appear here for this visit. A full refresh clears
          everything. Saved history will appear once the database is connected.
        </p>
      </div>

      {total === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-surface/30 px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
            <BarChart3 className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">
            No results this session
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Finish a test and its score will show here until you refresh the
            page.
          </p>
          <Link
            href="/student/typing"
            className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand/90"
          >
            Start a test
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryStat label="Tests this session" value={total} />
            <SummaryStat label="Average WPM" value={avgWpm} />
            <SummaryStat label="Average accuracy" value={`${avgAccuracy}%`} />
            <SummaryStat
              label="Best WPM"
              value={best?.wpm ?? 0}
              hint={best?.practice}
            />
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Current session
              </h2>
              <button
                onClick={() => clearSessionResults()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" />
                Clear
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/60">
                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Practice
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      WPM
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Raw WPM
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Accuracy
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Correct words
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Errors
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-border/60 last:border-b-0 transition-colors hover:bg-surface/40"
                    >
                      <td className="px-4 py-3 text-foreground">
                        {r.practice}
                        {!r.counted && (
                          <span className="ml-2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            practice
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.category}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                        {r.wpm}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                        {r.rawWpm}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                        {r.accuracy}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                        {r.correctWords}/{r.totalWords}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                        {r.errors}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {r.duration}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Headphones,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Keyboard,
} from 'lucide-react';
import {
  StudentHeader,
  StudentStatusBadge,
} from '@/components/student/student-header';
import { assignedDictations } from '@/lib/student-data';
import { mockDictations } from '@/lib/dictation-transcripts';
import { cn } from '@/lib/utils';

export default function StudentDictationsPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const transcripts = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of mockDictations) map.set(d.id, d.referenceTranscript);
    return map;
  }, []);

  return (
    <div className="space-y-8">
      <StudentHeader
        title="My dictations"
        description="Read a passage, then type it blind. Audio dictations are being rebuilt around YouTube and are coming later."
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800 font-medium">
          🚧 Demo dictations — type the transcript below in blind mode.
        </p>
        <p className="mt-1 text-xs text-amber-700">
          The text under each card is exactly what you will type. Hit{' '}
          <span className="font-medium">Try typing</span> to practise it.
          Results are session-only and cleared on refresh.
        </p>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Available dictations
          </h2>
          <span className="text-xs text-muted-foreground">
            {assignedDictations.length} dictations
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {assignedDictations.map((d) => {
            const transcript = transcripts.get(d.id) ?? '';
            const isOpen = expanded[d.id] ?? false;

            return (
              <div
                key={d.id}
                className="flex flex-col rounded-lg border border-border bg-surface p-4 sm:p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-brand">
                    <Headphones className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <StudentStatusBadge status={d.status} />
                </div>

                <h3 className="text-base font-semibold text-foreground">
                  {d.title}
                </h3>

                <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd className="text-right text-foreground">{d.category}</dd>
                  <dt className="text-muted-foreground">Length</dt>
                  <dd className="text-right font-mono text-foreground">
                    {transcript.split(/\s+/).filter(Boolean).length} words
                  </dd>
                </dl>

                {/* What the student has to type */}
                <div className="mt-3 rounded-md border border-border bg-background">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [d.id]: !isOpen }))
                    }
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span>What you&apos;ll type</span>
                    {isOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                  <p
                    className={cn(
                      'whitespace-pre-wrap break-words px-3 pb-3 font-mono text-[13px] leading-relaxed text-foreground/85',
                      !isOpen && 'line-clamp-3'
                    )}
                  >
                    {transcript}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                  <Link
                    href={`/student/typing?mode=dictation&dictationId=${d.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand/90"
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                    Try typing
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

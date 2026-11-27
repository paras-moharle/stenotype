'use client';

import { ReferenceReview } from './reference-review';
import { ReviewBlock } from './completion-panel';
import { useTypingAlignment } from './use-typing-alignment';

export function HistoricalReview({ reference, typed }: { reference: string; typed: string }) {
  const { alignment, pending } = useTypingAlignment(reference, typed, true, true);
  return (
    <section className="space-y-4">
      <h2 className="text-h2 font-semibold">Transcription review</h2>
      {pending ? <p role="status">Preparing the comparison…</p> : alignment ? <><ReferenceReview alignment={alignment} transcript /><ReviewBlock alignment={alignment} transcript /></> : (
        <div className="panel p-5">
          <p role="status">The comparison is unavailable. Your saved transcription is shown below.</p>
          <p className="mt-3 whitespace-pre-wrap wrap-break-word font-mono">{typed}</p>
        </div>
      )}
      {!alignment && <details className="panel p-4">
        <summary className="cursor-pointer font-medium">Official reference used for this attempt</summary>
        <p className="mt-4 whitespace-pre-wrap wrap-break-word font-mono">{reference}</p>
      </details>}
    </section>
  );
}

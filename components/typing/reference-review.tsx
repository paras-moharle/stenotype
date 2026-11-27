import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { referenceReview } from '@/lib/typing/reference-review';
import type { AlignmentResult } from '@/lib/typing/scoring';

export function ReferenceReview({ alignment, transcript = false }: {
  alignment: AlignmentResult;
  transcript?: boolean;
}) {
  const { attempted, remaining, remainingItems, extras } = referenceReview(alignment, transcript);
  return (
    <div className="rounded-2xl border border-border bg-background/70">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{transcript ? 'Transcript comparison' : 'Passage comparison'}</h3>
        <span className="text-xs text-muted-foreground">
          Correct · wrong (dotted) · missed (dashed)
        </span>
      </div>
      <div
        role="region"
        aria-label="Passage coloured by result"
        tabIndex={0}
        className="max-h-[min(26rem,55dvh)] overflow-y-auto whitespace-pre-wrap wrap-break-word px-4 py-3 font-mono text-sm leading-relaxed sm:text-base"
      >
        {attempted.length ? attempted.map(({ text, tone }, index) => {
          // Alignment runs include the following separator. Keep it outside
          // the decorated inline box so it still wraps without an underline.
          const content = text.trimEnd();
          const separator = text.slice(content.length);
          return (
            <Fragment key={index}>
              <span className={cn(
                tone === 'correct' && 'text-typing-correct',
                tone === 'wrong' && 'text-typing-incorrect typing-wrong',
                tone === 'missed' && 'text-typing-missed underline decoration-dashed',
              )}>{content}</span>
              {separator}
            </Fragment>
          );
        }) : <p className="text-muted-foreground">No reference text was reached.</p>}
      </div>
      {extras.length > 0 && !transcript && (
        <p className="wrap-break-word border-t border-border px-4 py-3 text-sm">
          Extra typed items <span className="font-mono text-typing-incorrect line-through">{extras.join(' ')}</span>
        </p>
      )}
      {remainingItems > 0 && (
        <details className="border-t border-border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Show remaining reference · {remainingItems} not reached</summary>
          <p className="mt-3 whitespace-pre-wrap wrap-break-word font-mono leading-relaxed text-muted-foreground">{remaining}</p>
        </details>
      )}
    </div>
  );
}

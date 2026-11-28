import { useId, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { referenceReview } from '@/lib/typing/reference-review';

type Review = ReturnType<typeof referenceReview>;

export function ReferenceReview({ review, transcript = false }: {
  review: Review;
  transcript?: boolean;
}) {
  const { attempted, remaining, remainingItems } = review;
  const [shown, setShown] = useState<number | null>(null);
  const labelId = useId();
  const detailId = useId();
  const selected = shown === null ? undefined : attempted[shown];
  return (
    <div className="rounded-2xl border border-border bg-background/70">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{transcript ? 'Transcript comparison' : 'Passage comparison'}</h3>
        <p id={labelId} className="text-xs text-muted-foreground">
          Wrong is dotted · skipped is dashed · extra is struck through
        </p>
        {attempted.some(item => item.tone === 'wrong') && (
          <div id={detailId} role="status" className="h-14 basis-full overflow-auto rounded-lg bg-muted px-2 py-1.5 text-xs">
            {selected?.tone === 'wrong' ? (
              <dl className="grid grid-cols-2 gap-x-3">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Expected</dt>
                  <dd className="wrap-anywhere font-mono">{selected.text}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">You typed</dt>
                  <dd className="wrap-anywhere font-mono text-typing-incorrect">{selected.actual}</dd>
                </div>
              </dl>
            ) : <p className="text-muted-foreground">Select a wrong item to see what you typed.</p>}
          </div>
        )}
      </div>
      <div
        role="region"
        aria-label="Passage coloured by result"
        aria-describedby={labelId}
        tabIndex={0}
        className="max-h-[min(26rem,55dvh)] overflow-y-auto whitespace-pre-wrap wrap-break-word px-4 py-3 font-mono text-sm leading-relaxed sm:text-base"
      >
        {attempted.length ? attempted.map((item, index) => {
          if (item.tone === 'wrong') {
            const expanded = shown === index;
            return <button key={index} type="button"
              className={cn('cursor-pointer rounded-sm text-left text-typing-incorrect typing-wrong', expanded && 'bg-typing-incorrect/10')}
              aria-label={`Wrong item, expected ${item.text}`}
              aria-expanded={expanded}
              aria-controls={detailId}
              onClick={() => setShown(expanded ? null : index)}
            >{item.text}</button>;
          }
          return <span key={index} className={cn(
            item.tone === 'correct' && 'text-typing-correct',
            item.tone === 'missed' && 'text-typing-missed underline decoration-dashed',
            item.tone === 'extra' && 'text-typing-incorrect line-through',
          )}>{item.text}</span>;
        }) : <p className="text-muted-foreground">No reference text was reached.</p>}
      </div>
      <MistakeTable items={attempted} />
      {remainingItems > 0 && <details className="border-t border-border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Show remaining reference · {remainingItems} not reached</summary>
        <p className="mt-3 whitespace-pre-wrap wrap-break-word font-mono leading-relaxed text-muted-foreground">{remaining}</p>
      </details>}
    </div>
  );
}

const MISTAKES_PER_PAGE = 20;

function MistakeTable({ items }: { items: Review['attempted'] }) {
  const mistakes = useMemo(() => items.filter(item => item.tone !== 'correct'), [items]);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(MISTAKES_PER_PAGE);
  if (!mistakes.length) return null;

  return (
    <details className="border-t border-border px-4 py-3 text-sm" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer font-medium">Review all mistakes · {mistakes.length}</summary>
      {open && (
        <div className="mt-3">
          <table className="w-full table-fixed text-left">
            <caption className="sr-only">Mistakes in passage order</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1.5 font-medium">Expected</th>
                <th scope="col" className="px-2 py-1.5 font-medium">You typed</th>
              </tr>
            </thead>
            <tbody>
              {mistakes.slice(0, limit).map((item, index) => (
                <tr key={index} className="border-t border-border align-top">
                  <td className="wrap-anywhere px-2 py-1.5">
                    {item.tone === 'extra' ? <span className="text-xs text-muted-foreground">Extra item</span> :
                      <span className={cn('font-mono', item.tone === 'missed' && 'text-typing-missed underline decoration-dashed',
                        item.tone === 'wrong' && 'text-typing-incorrect typing-wrong')}>{item.text}</span>}
                  </td>
                  <td className="wrap-anywhere px-2 py-1.5">
                    {item.tone === 'missed' ? <span className="text-xs text-muted-foreground">Skipped</span> :
                      <span className={cn('font-mono text-typing-incorrect', item.tone === 'extra' && 'line-through')}>
                        {item.tone === 'wrong' ? item.actual : item.text}
                      </span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {limit < mistakes.length && (
            <button type="button" className="mt-2 min-h-11 rounded-lg px-2 font-medium underline underline-offset-4"
              onClick={() => setLimit(limit + MISTAKES_PER_PAGE)}>
              Show more mistakes
            </button>
          )}
        </div>
      )}
    </details>
  );
}

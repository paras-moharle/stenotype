import { ReferenceReview } from './reference-review';
import { ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TypingMode } from '@/lib/typing/mode-rules';
import { referenceReview } from '@/lib/typing/reference-review';
import { formatClock, type ScoreResult } from '@/lib/typing/scoring';

export function CompletionPanel({
  score,
  elapsedSec,
  mode,
  counted,
  timed,
  onRetry,
  onNewFree,
}: {
  score: ScoreResult;
  elapsedSec: number;
  mode: TypingMode;
  counted: boolean;
  timed: boolean;
  onRetry: () => void;
  onNewFree?: () => void;
}) {
  const review = referenceReview(score.alignment, mode === 'dictation');
  const showNotReached = timed || review.remainingItems > 0;
  const rows = [
    { label: 'Words', stats: score.words, remaining: review.remainingWords },
    { label: 'Punctuation', stats: score.punctuation, remaining: review.remainingItems - review.remainingWords },
    { label: 'All scored items', stats: score.items, remaining: review.remainingItems },
  ];

  return (
    <div className="animate-fade-in-up space-y-4 rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-typing-correct/10">
          <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Practice results</h2>
          {counted && <p className="text-sm text-muted-foreground">Saved to your results.</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          {onNewFree && (
            <Button
              variant="outline"
              onClick={onNewFree}
              className="gap-1.5"
            >
              New passage
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
        <ResultStat label="Net WPM" value={score.scored ? score.netWpm : '—'} />
        <ResultStat
          label="Attempted accuracy"
          value={`${score.accuracy}%`}

        />
        <ResultStat label="Passage covered" value={`${score.completion}%`} />
        <ResultStat label="Time" value={formatClock(elapsedSec)} />
      </div>

      <p className="text-xs text-muted-foreground">
        {score.items.correct} of {score.alignment.evaluatedItems} evaluated items were correct. Coverage measures characters.
        {showNotReached && review.evaluatedTailOmissions > 0 && (
          <> Accuracy also counted {review.evaluatedTailOmissions} unreached {review.evaluatedTailOmissions === 1 ? 'item' : 'items'} aligned before extra input.</>
        )}
      </p>
      <div className="rounded-2xl border border-border">
        <table className="w-full border-collapse text-xs tabular-nums sm:text-sm">
          <caption className="sr-only">Typing score breakdown</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="px-1 sm:px-3"><span className="sr-only">Item type</span></th>
              <th scope="col" className="px-1 py-2 text-right font-medium text-typing-correct sm:px-3">Correct</th>
              <th scope="col" className="px-1 py-2 text-right font-medium text-typing-incorrect sm:px-3">Wrong</th>
              <th scope="col" className="px-1 py-2 text-right font-medium text-typing-missed sm:px-3">Skipped</th>
              <th scope="col" className="px-1 py-2 text-right font-medium text-typing-incorrect sm:px-3">Extra</th>
              {showNotReached && <th scope="col" className="px-1 py-2 text-right font-medium sm:px-3">Not reached</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, stats, remaining }) => (
              <tr key={label} className="border-b border-border/60 last:border-0">
                <th scope="row" className="px-1 py-2 text-left font-medium sm:px-3">{label}</th>
                <td className="px-1 text-right text-typing-correct sm:px-3">{stats.correct}</td>
                <td className="px-1 text-right text-typing-incorrect sm:px-3">{stats.incorrect}</td>
                <td className="px-1 text-right text-typing-missed sm:px-3">{stats.missed - remaining}</td>
                <td className="px-1 text-right text-typing-incorrect sm:px-3">{stats.extra}</td>
                {showNotReached && <td className="px-1 text-right text-muted-foreground sm:px-3">{remaining}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-right font-mono text-xs tabular-nums text-muted-foreground">Gross {score.scored ? score.rawWpm : '—'} WPM</p>

      {!score.scored && (
        <p className="rounded-2xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          This attempt is too short for a speed score. It needs at least 3
          seconds and 10 typed characters. Accuracy above is still measured.
        </p>
      )}

      <ReferenceReview review={review} transcript={mode === 'dictation'} />
    </div>
  );
}

function ResultStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}

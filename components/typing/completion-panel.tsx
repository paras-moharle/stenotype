import { ReferenceReview } from './reference-review';
import { useMemo } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TypingMode } from '@/lib/typing/mode-rules';
import {
  buildTokenDisplayItems,
  formatClock,
  splitMissedNotReached,
  type AlignmentResult,
  type ScoreResult,
  type TokenDiffEntry,
} from '@/lib/typing/scoring';

export function CompletionPanel({
  score,
  elapsedSec,
  mode,
  counted,
  public: isPublic,
  showReview,
  onRetry,
  onNewFree,
}: {
  score: ScoreResult;
  elapsedSec: number;
  mode: TypingMode;
  counted: boolean;
  public?: boolean;
  showReview: boolean;
  onRetry: () => void;
  onNewFree?: () => void;
}) {
  const words = score.words;
  const items = score.items;
  const missedWordCount = words.missed;
  const missedPunctCount = score.punctuation.missed;

  const verdict =
    score.accuracy >= 95
      ? {
          title: isPublic
            ? 'Excellent — highly accurate.'
            : 'Excellent — your transcription is highly accurate.',
          detail: 'Push for speed next time.',
        }
      : score.accuracy >= 85
        ? {
            title: 'Solid run — keep the consistency.',
            detail: 'Keep practising to maintain this level.',
          }
        : {
            title: 'Type naturally — speed will follow.',
            detail:
              mode === 'free'
                ? 'Slow down on the tricky words, then go again.'
                : 'See your word-by-word comparison below.',
          };

  return (
    <div className="animate-fade-in-up space-y-4 rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-typing-correct/10">
          <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {verdict.title}
            </h2>
            {!isPublic && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                  counted
                    ? 'border-brand/40 bg-brand/10 text-brand'
                    : 'border-border bg-background text-muted-foreground'
                )}
              >
                {counted ? (
                  <>
                    <EyeOff className="h-3 w-3" /> Saved practice
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3" /> Practice mode
                  </>
                )}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{verdict.detail}</p>
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
        <ResultStat label="Net WPM" value={score.netWpm} accent={counted} />
        <ResultStat
          label="Attempted accuracy"
          value={`${score.accuracy}%`}
          accent={counted}
        />
        <ResultStat label="Passage covered" value={`${score.completion}%`} />
        <ResultStat label="Time" value={formatClock(elapsedSec)} />
      </div>

      {/* These two numbers answer different questions, so the
          denominator for each is spelled out instead of letting a
          reader compare "words correct" with "accuracy". */}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">
          Attempted accuracy
        </span>{' '}
        = {score.items.correct} correct ÷{' '}
        {score.alignment.evaluatedItems} items you attempted (words +
        punctuation). <span className="font-medium text-foreground">
          Passage coverage
        </span>{' '}
        = how much of the passage you covered. Case counts.
      </p>

      <div className="border-t border-border pt-3">
        <div className="overflow-x-auto rounded-2xl border border-border" role="region" aria-label="Typing score breakdown" tabIndex={0}>
          <table className="w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border bg-background text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium" />
                <th className="px-3 py-2 text-right font-medium">
                  In passage
                </th>
                <th className="px-3 py-2 text-right font-medium text-typing-correct">Correct</th>
                <th className="px-3 py-2 text-right font-medium text-typing-incorrect">Wrong</th>
                <th className="px-3 py-2 text-right font-medium text-typing-missed">Missed</th>
                <th className="px-3 py-2 text-right font-medium text-typing-incorrect">Extra</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/60">
                <td className="px-3 py-2 font-medium text-foreground">
                  Words
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {words.total}
                </td>
                <td className="px-3 py-2 text-right text-typing-correct">
                  {words.correct}
                </td>
                <td className="px-3 py-2 text-right text-typing-incorrect">
                  {words.incorrect}
                </td>
                <td className="px-3 py-2 text-right text-typing-missed">
                  {missedWordCount}
                </td>
                <td className="px-3 py-2 text-right text-typing-incorrect">
                  {words.extra}
                </td>
              </tr>
              {score.punctuation.total > 0 && (
                <tr>
                  <td className="px-3 py-2 font-medium text-foreground">
                    Punctuation
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {score.punctuation.total}
                  </td>
                  <td className="px-3 py-2 text-right text-typing-correct">
                    {score.punctuation.correct}
                  </td>
                  <td className="px-3 py-2 text-right text-typing-incorrect">
                    {score.punctuation.incorrect}
                  </td>
                  <td className="px-3 py-2 text-right text-typing-missed">
                    {missedPunctCount}
                  </td>
                  <td className="px-3 py-2 text-right text-typing-incorrect">
                    {score.punctuation.extra}
                  </td>
                </tr>
              )}
              <tr className="border-t border-border bg-background/60">
                <td className="px-3 py-2 font-medium text-foreground">
                  All scored items
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {items.total}
                </td>
                <td className="px-3 py-2 text-right text-typing-correct">
                  {items.correct}
                </td>
                <td className="px-3 py-2 text-right text-typing-incorrect">
                  {items.incorrect}
                </td>
                <td className="px-3 py-2 text-right text-typing-missed">
                  {items.missed}
                </td>
                <td className="px-3 py-2 text-right text-typing-incorrect">
                  {items.extra}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-muted-foreground">
          <span className="ml-auto">Gross {score.rawWpm} WPM</span>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Words and punctuation are scored as separate items. &quot;Missed&quot;
        includes everything you did not type, including the rest of the
        passage. Only attempted items affect accuracy.
      </p>

      {!score.scored && (
        <p className="rounded-2xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          This attempt is too short for a speed score. It needs at least 3
          seconds and 10 typed characters. Accuracy above is still measured.
        </p>
      )}

      {!isPublic &&
        (mode === 'dictation' ? (
          // The panel only renders for dictation once the server has
          // returned the transcript, which means the row was written.
          <p className="rounded-2xl border border-typing-correct/20 bg-typing-correct/[0.05] px-3 py-2 text-xs text-muted-foreground">
            Saved to your results.
          </p>
        ) : (
          <p className="rounded-2xl border border-typing-missed/20 bg-typing-missed/[0.045] px-3 py-2 text-xs text-muted-foreground">
            This score is shown for this visit only — free practice and custom
            text are not saved.
          </p>
        ))}

      {!counted && !isPublic && mode !== 'dictation' && (
        <p className="rounded-2xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          Only dictation attempts are saved to your results.
        </p>
      )}

      <ReferenceReview alignment={score.alignment} transcript={mode === 'dictation'} />

      {showReview && (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Your typing
                </h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Color-coded against the passage.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <LegendSwatch
                  className="bg-typing-correct/30"
                  borderClass="border-typing-correct/40"
                  label="Correct"
                />
                <LegendSwatch
                  className="bg-typing-incorrect/30"
                  borderClass="border-typing-incorrect/40"
                  label="Wrong / extra"
                />
                <LegendSwatch
                  className="bg-typing-missed/30"
                  borderClass="border-typing-missed/40"
                  label="Missed"
                />
              </div>
            </div>

            <ReviewBlock alignment={score.alignment} transcript={mode === 'dictation'} />
          </div>

          <DiffTable entries={score.alignment.tokenDiff} />
        </div>
      )}
    </div>
  );
}

function ResultStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'font-mono text-2xl font-semibold tabular-nums tracking-tight',
          accent ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LegendSwatch({
  className,
  label,
  borderClass,
}: {
  className: string;
  label: string;
  borderClass?: string;
}) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2 text-[10px] font-medium text-muted-foreground">
      <span
        className={cn(
          'h-2 w-2 rounded-full border',
          borderClass ?? 'border-border',
          className
        )}
      />
      {label}
    </span>
  );
}

export function ReviewBlock({
  alignment,
  transcript = false,
}: {
  alignment: AlignmentResult;
  transcript?: boolean;
}) {
  const displayItems = useMemo(
    () => buildTokenDisplayItems(alignment),
    [alignment]
  );

  // Skipped words are "missed"; the untouched tail was never attempted.
  // Showing both as "missed" overstated the error, so they are split.
  const { missed: missedTokens, notReached } = useMemo(
    () => splitMissedNotReached(alignment),
    [alignment]
  );

  const displayChar = (ch: string) => (ch === ' ' ? '\u00A0' : ch);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-background/70 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border/70 px-3 py-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Your typing
        </span>
        <span className="text-[10px] text-muted-foreground">
          Green correct · red wrong or extra · amber missed
        </span>
      </div>

      <div className="max-h-[32rem] overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
        <p className="whitespace-pre-wrap break-words font-mono text-[15px] leading-[1.9] tracking-[0.01em] sm:text-base sm:leading-[2] lg:text-[17px]">
          {displayItems.length === 0 ? (
            <span className="text-muted-foreground">Nothing typed.</span>
          ) : (
            displayItems.map((item, index) => {
              if (item.state === 'correct') {
                return (
                  <span key={index} className="font-medium text-typing-correct">
                    {displayChar(item.ch)}
                  </span>
                );
              }

              // Extras are red like wrong tokens but struck through,
              // so "how many red tokens" never silently includes
              // insertions the table reports in its own "Extra" column.
              return (
                <span
                  key={index}
                  title={
                    item.state === 'extra'
                      ? 'Extra — you typed this but the passage does not have it.'
                      : item.expected
                        ? `Expected “${item.expected}”.`
                        : undefined
                  }
                  className={cn(
                    'text-typing-incorrect typing-wrong',
                    item.state === 'extra' && 'line-through'
                  )}
                >
                  {displayChar(item.ch)}
                </span>
              );
            })
          )}
        </p>

        {!transcript && missedTokens.length > 0 && (
          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Missed words &amp; punctuation
            </p>
            <div className="flex flex-wrap gap-1.5">
              {missedTokens.map((entry, i) => (
                <span
                  key={`missed-${entry.index}-${i}`}
                  title={`Missed ${entry.tokenKind === 'punct' ? 'punctuation' : 'word'} ${entry.index + 1}.`}
                  className="rounded-md bg-typing-missed/10 px-1.5 py-1 font-mono text-[13px] text-typing-missed"
                >
                  {entry.expected}
                </span>
              ))}
            </div>
          </div>
        )}

        {!transcript && notReached.length > 0 && (
          <p className="mt-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            {notReached.length} further item
            {notReached.length === 1 ? '' : 's'} were never reached — the rest
            of the passage.
          </p>
        )}
      </div>
    </div>
  );
}

function DiffSnippet({
  value,
  emptyLabel,
  tone,
}: {
  value: string | null;
  emptyLabel: string;
  tone: 'plain' | 'missed' | 'wrong';
}) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs italic text-muted-foreground">
        <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-typing-missed/60" />
        {emptyLabel}
      </span>
    );
  }

  const MAX = 60;
  const preview = value.slice(0, MAX);

  return (
    <span
      className={cn(
        'block break-words font-mono text-[13px] leading-relaxed',
        tone === 'missed' && 'text-typing-missed',
        tone === 'wrong' && 'text-typing-incorrect',
        tone === 'plain' && 'text-foreground'
      )}
    >
      “<span className={tone === 'wrong' ? 'typing-wrong' : undefined}>{preview}</span>
      {value.length > MAX ? '…' : ''}”
      {value.length > MAX && (
        <span className="ml-1 text-muted-foreground">
          +{value.length - MAX} more
        </span>
      )}
    </span>
  );
}

function DiffTable({ entries }: { entries: TokenDiffEntry[] }) {
  const tableRows = useMemo(
    () => entries.filter((entry) => entry.kind !== 'missed'),
    [entries]
  );
  const LIMIT = 80;
  const shown = tableRows.slice(0, LIMIT);
  const hidden = tableRows.length - shown.length;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>Word &amp; punctuation differences</span>
        <span className="ml-auto font-mono tabular-nums">
          {tableRows.length} wrong/extra
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-typing-correct/40 bg-typing-correct/10 px-3 py-4 text-sm text-foreground">
          No differences — every word and punctuation mark matched the passage.
        </p>
      ) : tableRows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-background px-3 py-4 text-sm text-muted-foreground">
          No wrong or extra items. Missed items are marked in the review above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 px-2 py-2 text-left font-medium">#</th>
                  <th className="px-2 py-2 text-left font-medium">Passage</th>
                  <th className="px-2 py-2 text-left font-medium">You typed</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry, rowIndex) => (
                  <tr
                    key={`${entry.index}-${entry.kind}-${rowIndex}`}
                    className="border-b border-border/60 align-top last:border-0"
                  >
                    <td className="px-2 py-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {entry.index + 1}
                      <span className="ml-1 text-[9px] uppercase tracking-wider opacity-70">
                        {entry.tokenKind === 'punct' ? 'punct' : 'word'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <DiffSnippet
                        value={entry.expected}
                        emptyLabel="—"
                        tone="plain"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <DiffSnippet
                        value={entry.actual}
                        emptyLabel="skipped"
                        tone="wrong"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hidden > 0 && (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Showing the first {LIMIT} of {tableRows.length} differences.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

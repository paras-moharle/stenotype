import { splitMissedNotReached, type AlignmentResult } from './scoring';

type ReviewItem =
  | { tone: 'correct' | 'missed' | 'extra'; text: string }
  | { tone: 'wrong'; text: string; actual: string };

export function referenceReview(alignment: AlignmentResult, fullReference: boolean) {
  const omissions = splitMissedNotReached(alignment);
  const tail = fullReference ? [] : omissions.notReached;
  const tailIndices = new Set(tail.map(entry => entry.index));
  const attempted: ReviewItem[] = [];
  let previous: (typeof alignment.tokenOps)[number] | undefined;

  for (const operation of alignment.tokenOps) {
    if (operation.type !== 'insert' && tailIndices.has(operation.refIndex)) continue;

    const ref = 'refIndex' in operation ? alignment.refTokens[operation.refIndex] : undefined;
    const typed = 'typedIndex' in operation ? alignment.typedTokens[operation.typedIndex] : undefined;
    let separator = '';
    if (previous) {
      if ((operation.type === 'insert' || previous.type === 'insert') && typed && 'typedIndex' in previous) {
        separator = alignment.typed.slice(alignment.typedTokens[previous.typedIndex].end, typed.start);
      } else if (ref && 'refIndex' in previous) {
        separator = alignment.reference.slice(alignment.refTokens[previous.refIndex].end, ref.start);
      } else {
        // An insertion next to a deletion has no shared whitespace anchor.
        separator = operation.type === 'insert' && typed?.kind === 'punct' ? '' : ' ';
      }
    }
    if (separator) append({ tone: 'correct', text: separator });
    if (operation.type === 'insert') append({ tone: 'extra', text: alignment.typedTokens[operation.typedIndex].text });
    else if (operation.type === 'substitute') append({
      tone: 'wrong',
      text: alignment.refTokens[operation.refIndex].text,
      actual: alignment.typedTokens[operation.typedIndex].text,
    });
    else append({ tone: operation.type === 'equal' ? 'correct' : 'missed', text: alignment.refTokens[operation.refIndex].text });
    previous = operation;
  }

  function append(item: ReviewItem) {
    const last = attempted.at(-1);
    if (last?.tone === 'correct' && item.tone === 'correct') last.text += item.text;
    else attempted.push(item);
  }

  if (tail.length && previous && 'refIndex' in previous) {
    const end = alignment.refTokens[previous.refIndex].end;
    const start = alignment.refTokens[tail[0].index].start;
    const gap = alignment.reference.slice(end, start);
    if (gap && !gap.trim()) append({ tone: 'correct', text: gap });
  }

  const remaining = tail.length ? alignment.reference.slice(alignment.refTokens[tail[0].index].start) : '';
  return {
    attempted,
    remaining,
    remainingItems: tail.length,
    remainingWords: tail.filter(entry => entry.tokenKind === 'word').length,
    evaluatedTailOmissions: alignment.evaluatedItems - alignment.typedTokens.length - omissions.missed.length,
  };
}

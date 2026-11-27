import { splitMissedNotReached, type AlignmentResult } from './scoring';

type ReviewTone = 'correct' | 'wrong' | 'missed';

export function referenceReview(alignment: AlignmentResult, transcript: boolean) {
  const tail = new Set(transcript ? [] : splitMissedNotReached(alignment).notReached.map(entry => entry.index));
  const attempted: { text: string; tone: ReviewTone }[] = [];
  const remaining: string[] = [];
  const extras: string[] = [];

  for (const operation of alignment.tokenOps) {
    if (operation.type === 'insert') {
      extras.push(alignment.typedTokens[operation.typedIndex].text);
      continue;
    }
    const token = alignment.refTokens[operation.refIndex];
    const next = alignment.refTokens[operation.refIndex + 1];
    const text = alignment.reference.slice(token.start, next?.start);
    if (tail.has(operation.refIndex)) remaining.push(text);
    else attempted.push({
      text,
      tone: operation.type === 'equal' ? 'correct' : operation.type === 'substitute' ? 'wrong' : 'missed',
    });
  }

  return { attempted, remaining: remaining.join(''), remainingItems: remaining.length, extras };
}

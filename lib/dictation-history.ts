import type { Prisma } from '@/generated/prisma/client';

// A concrete related-row predicate also works against the legacy nullable
// column. Filter before Prisma hydrates the now-required relation.
export const dictationAttemptsWhere = {
  dictation: { is: { status: { in: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] } } },
} satisfies Prisma.TypingAttemptWhereInput;

export const dictationHistorySelect = {
  id: true,
  wpm: true,
  accuracy: true,
  completion: true,
  wordsCorrect: true,
  wordsIncorrect: true,
  wordsExtra: true,
  wordsMissed: true,
  wordsTotal: true,
  punctuationCorrect: true,
  punctuationIncorrect: true,
  punctuationExtra: true,
  punctuationMissed: true,
  punctuationTotal: true,
  completed: true,
  createdAt: true,
  dictation: { select: { id: true, title: true, category: true } },
} satisfies Prisma.TypingAttemptSelect;

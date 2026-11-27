/**
 * Attempt snapshot — the exact numbers persisted for a scored dictation.
 *
 * One function maps the engine result to the database columns, so the
 * API can never drift from the schema and the result screen can trust
 * what it reads back.
 *
 * Only the word/punctuation breakdown is persisted. The old character
 * counters were removed in the drop_legacy_attempt_columns migration.
 */

import type { ScoreResult, TokenStats } from './scoring';

export type AttemptSnapshot = {
  /** Reference covered, 0-100. */
  completion: number;

  wordsCorrect: number;
  wordsIncorrect: number;
  wordsExtra: number;
  wordsMissed: number;
  wordsTotal: number;

  punctuationCorrect: number;
  punctuationIncorrect: number;
  punctuationExtra: number;
  punctuationMissed: number;
  punctuationTotal: number;
};

function snapshotOf(stats: TokenStats) {
  return {
    correct: stats.correct,
    incorrect: stats.incorrect,
    extra: stats.extra,
    missed: stats.missed,
    total: stats.total,
  };
}

export function attemptSnapshot(score: ScoreResult): AttemptSnapshot {
  const words = snapshotOf(score.words);
  const punctuation = snapshotOf(score.punctuation);

  return {
    completion: score.completion,

    wordsCorrect: words.correct,
    wordsIncorrect: words.incorrect,
    wordsExtra: words.extra,
    wordsMissed: words.missed,
    wordsTotal: words.total,

    punctuationCorrect: punctuation.correct,
    punctuationIncorrect: punctuation.incorrect,
    punctuationExtra: punctuation.extra,
    punctuationMissed: punctuation.missed,
    punctuationTotal: punctuation.total,
  };
}

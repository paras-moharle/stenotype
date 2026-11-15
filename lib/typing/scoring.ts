/**
 * Typing engine — authoritative scoring, alignment and comparison.
 *
 * Normalization policy:
 *   - runs of whitespace collapse to a single space
 *   - leading / trailing whitespace is ignored
 *   - word matching is case-sensitive
 *   - punctuation is counted
 */

export type CharState = 'correct' | 'wrong' | 'missed' | 'extra';

export type AlignmentOp =
  | { type: 'equal'; refIndex: number; typedIndex: number; ch: string }
  | {
      type: 'substitute';
      refIndex: number;
      typedIndex: number;
      refCh: string;
      typedCh: string;
    }
  | { type: 'delete'; refIndex: number; ch: string }
  | { type: 'insert'; typedIndex: number; ch: string };

export type WordStats = {
  /** Reference words in the passage. */
  total: number;
  /** Reference words typed exactly, including case and punctuation. */
  correct: number;
  /** Reference words paired with a different typed word. */
  incorrect: number;
  /** Reference words with no paired typed word. */
  missed: number;
  /** Typed words with no paired reference word. */
  extra: number;
};

export type DisplayItem = {
  ch: string;
  state: CharState;
  refIndex?: number;
  typedIndex?: number;
  expected?: string;
};

export type WordDiffKind = 'wrong' | 'missed' | 'extra';

export type WordDiffEntry = {
  /** 0-based reference word position; length means after the last word. */
  index: number;
  expected: string | null;
  actual: string | null;
  kind: WordDiffKind;
};

export type AlignmentResult = {
  reference: string;
  typed: string;
  ops: AlignmentOp[];
  /** Character-level Levenshtein distance. */
  distance: number;
  /**
   * Unresolved character edits in the attempted portion. A deletion in
   * the untouched tail is excluded; an internal omission is included.
   */
  typedErrors: number;
  refLength: number;
  typedLength: number;
  matches: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  words: WordStats;
  wordDiff: WordDiffEntry[];
  /**
   * Words included in accuracy: all typed words plus skipped reference
   * words before later typed words. The untouched reference tail is out.
   */
  evaluatedWords: number;
};

export type ScoreResult = {
  /** Normalized typed character count, including spaces and punctuation. */
  typed: number;
  /** Characters that matched exactly. */
  correct: number;
  /** Unresolved character edits in the attempted portion. */
  errors: number;
  /** Exact attempted-word accuracy, 0–100; untouched tail is excluded. */
  accuracy: number;
  /** Reference characters covered, 0–100. */
  completion: number;
  /** Net WPM alias. */
  wpm: number;
  /** Gross WPM: typed characters / 5 / elapsed minutes. */
  rawWpm: number;
  /** Gross WPM adjusted by attempted-word accuracy. */
  netWpm: number;
  elapsedMs: number;
  /** False when the attempt is too short to score reliably. */
  scored: boolean;
  words: WordStats;
  alignment: AlignmentResult;
};

export const MIN_SCORED_ELAPSED_MS = 1000;
export const MIN_SCORED_TYPED_CHARS = 5;

export function normalizeText(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

type Token = { text: string; start: number; end: number };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return tokens;
}

type WordAlignmentOp =
  | { type: 'equal'; refIndex: number; typedIndex: number }
  | { type: 'substitute'; refIndex: number; typedIndex: number }
  | { type: 'delete'; refIndex: number }
  | { type: 'insert'; typedIndex: number };

/**
 * Align word tokens exactly. A substitution represents one wrong word;
 * insertions and deletions do not shift later exact matches.
 */
function alignWords(
  reference: Token[],
  typed: Token[]
): WordAlignmentOp[] {
  const n = reference.length;
  const m = typed.length;
  const ops: WordAlignmentOp[] = [];

  let prefix = 0;
  while (
    prefix < n &&
    prefix < m &&
    reference[prefix].text === typed[prefix].text
  ) {
    ops.push({ type: 'equal', refIndex: prefix, typedIndex: prefix });
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < n - prefix &&
    suffix < m - prefix &&
    reference[n - 1 - suffix].text === typed[m - 1 - suffix].text
  ) {
    suffix += 1;
  }

  const rStart = prefix;
  const rEnd = n - suffix;
  const tStart = prefix;
  const tEnd = m - suffix;
  const rn = rEnd - rStart;
  const tn = tEnd - tStart;

  if (rn === 0) {
    for (let j = 0; j < tn; j += 1) {
      ops.push({ type: 'insert', typedIndex: tStart + j });
    }
  } else if (tn === 0) {
    for (let i = 0; i < rn; i += 1) {
      ops.push({ type: 'delete', refIndex: rStart + i });
    }
  } else {
    const width = tn + 1;
    const size = (rn + 1) * width;
    const dp =
      rn + tn < 0xffff ? new Uint16Array(size) : new Uint32Array(size);

    for (let i = rn; i >= 0; i -= 1) {
      const row = i * width;

      for (let j = tn; j >= 0; j -= 1) {
        if (i === rn) {
          dp[row + j] = tn - j;
        } else if (j === tn) {
          dp[row + j] = rn - i;
        } else {
          const cost =
            reference[rStart + i].text === typed[tStart + j].text ? 0 : 1;
          const diagonal = dp[(i + 1) * width + (j + 1)] + cost;
          const deletion = dp[(i + 1) * width + j] + 1;
          const insertion = dp[row + j + 1] + 1;

          dp[row + j] = Math.min(diagonal, deletion, insertion);
        }
      }
    }

    let i = 0;
    let j = 0;

    while (i < rn || j < tn) {
      const here = dp[i * width + j];

      if (i < rn && j < tn) {
        const same =
          reference[rStart + i].text === typed[tStart + j].text;

        if (same && dp[(i + 1) * width + (j + 1)] === here) {
          ops.push({
            type: 'equal',
            refIndex: rStart + i,
            typedIndex: tStart + j,
          });
          i += 1;
          j += 1;
          continue;
        }

        if (dp[(i + 1) * width + (j + 1)] + 1 === here) {
          ops.push({
            type: 'substitute',
            refIndex: rStart + i,
            typedIndex: tStart + j,
          });
          i += 1;
          j += 1;
          continue;
        }
      }

      if (i < rn && dp[(i + 1) * width + j] + 1 === here) {
        ops.push({ type: 'delete', refIndex: rStart + i });
        i += 1;
        continue;
      }

      ops.push({ type: 'insert', typedIndex: tStart + j });
      j += 1;
    }
  }

  for (let k = suffix; k > 0; k -= 1) {
    ops.push({
      type: 'equal',
      refIndex: n - k,
      typedIndex: m - k,
    });
  }

  return ops;
}

/**
 * Align normalized strings with Levenshtein distance and backtrace.
 * Exact common prefixes and suffixes are matched first.
 */
export function align(
  referenceInput: string,
  typedInput: string
): AlignmentResult {
  const reference = normalizeText(referenceInput);
  const typed = normalizeText(typedInput);
  const n = reference.length;
  const m = typed.length;
  const ops: AlignmentOp[] = [];

  let prefix = 0;
  while (prefix < n && prefix < m && reference[prefix] === typed[prefix]) {
    ops.push({
      type: 'equal',
      refIndex: prefix,
      typedIndex: prefix,
      ch: reference[prefix],
    });
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < n - prefix &&
    suffix < m - prefix &&
    reference[n - 1 - suffix] === typed[m - 1 - suffix]
  ) {
    suffix += 1;
  }

  const rStart = prefix;
  const rEnd = n - suffix;
  const tStart = prefix;
  const tEnd = m - suffix;
  const rn = rEnd - rStart;
  const tn = tEnd - tStart;

  if (rn === 0) {
    for (let j = 0; j < tn; j += 1) {
      ops.push({
        type: 'insert',
        typedIndex: tStart + j,
        ch: typed[tStart + j],
      });
    }
  } else if (tn === 0) {
    for (let i = 0; i < rn; i += 1) {
      ops.push({
        type: 'delete',
        refIndex: rStart + i,
        ch: reference[rStart + i],
      });
    }
  } else {
    const width = tn + 1;
    const size = (rn + 1) * width;
    const dp =
      rn + tn < 0xffff ? new Uint16Array(size) : new Uint32Array(size);

    for (let i = rn; i >= 0; i -= 1) {
      const row = i * width;

      for (let j = tn; j >= 0; j -= 1) {
        if (i === rn) {
          dp[row + j] = tn - j;
        } else if (j === tn) {
          dp[row + j] = rn - i;
        } else {
          const cost =
            reference[rStart + i] === typed[tStart + j] ? 0 : 1;
          const diagonal = dp[(i + 1) * width + (j + 1)] + cost;
          const deletion = dp[(i + 1) * width + j] + 1;
          const insertion = dp[row + j + 1] + 1;

          dp[row + j] = Math.min(diagonal, deletion, insertion);
        }
      }
    }

    let i = 0;
    let j = 0;

    while (i < rn || j < tn) {
      const here = dp[i * width + j];

      if (i < rn && j < tn) {
        const refCh = reference[rStart + i];
        const typedCh = typed[tStart + j];

        if (refCh === typedCh && dp[(i + 1) * width + (j + 1)] === here) {
          ops.push({
            type: 'equal',
            refIndex: rStart + i,
            typedIndex: tStart + j,
            ch: refCh,
          });
          i += 1;
          j += 1;
          continue;
        }

        if (dp[(i + 1) * width + (j + 1)] + 1 === here) {
          ops.push({
            type: 'substitute',
            refIndex: rStart + i,
            typedIndex: tStart + j,
            refCh,
            typedCh,
          });
          i += 1;
          j += 1;
          continue;
        }
      }

      if (i < rn && dp[(i + 1) * width + j] + 1 === here) {
        ops.push({
          type: 'delete',
          refIndex: rStart + i,
          ch: reference[rStart + i],
        });
        i += 1;
        continue;
      }

      ops.push({
        type: 'insert',
        typedIndex: tStart + j,
        ch: typed[tStart + j],
      });
      j += 1;
    }
  }

  for (let k = suffix; k > 0; k -= 1) {
    const refIndex = n - k;
    const typedIndex = m - k;
    ops.push({
      type: 'equal',
      refIndex,
      typedIndex,
      ch: reference[refIndex],
    });
  }

  let matches = 0;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;

  for (const op of ops) {
    if (op.type === 'equal') matches += 1;
    else if (op.type === 'substitute') substitutions += 1;
    else if (op.type === 'delete') deletions += 1;
    else insertions += 1;
  }

  const distance = substitutions + deletions + insertions;

  // A deletion is an attempted-region error when a typed character
  // follows it. Trailing deletions are the untouched passage tail.
  let typedErrors = substitutions + insertions;
  let hasTypedCharAfter = false;

  for (let i = ops.length - 1; i >= 0; i -= 1) {
    const op = ops[i];

    if (op.type === 'delete' && hasTypedCharAfter) {
      typedErrors += 1;
    }

    if (op.type !== 'delete') {
      hasTypedCharAfter = true;
    }
  }

  const refTokens = tokenize(reference);
  const typedTokens = tokenize(typed);
  const wordOps = alignWords(refTokens, typedTokens);

  const words: WordStats = {
    total: refTokens.length,
    correct: 0,
    incorrect: 0,
    missed: 0,
    extra: 0,
  };
  const wordDiff: WordDiffEntry[] = [];

  // A skipped reference word is included in accuracy only if a typed
  // word follows it. This excludes the untouched tail.
  const internalMisses = new Set<number>();
  let hasTypedWordAfter = false;

  for (let i = wordOps.length - 1; i >= 0; i -= 1) {
    const op = wordOps[i];

    if (op.type === 'delete' && hasTypedWordAfter) {
      internalMisses.add(op.refIndex);
    }

    if (op.type !== 'delete') {
      hasTypedWordAfter = true;
    }
  }

  let refCursor = 0;

  for (const op of wordOps) {
    if (op.type === 'equal') {
      words.correct += 1;
      refCursor = op.refIndex + 1;
    } else if (op.type === 'substitute') {
      words.incorrect += 1;
      wordDiff.push({
        index: op.refIndex,
        expected: refTokens[op.refIndex].text,
        actual: typedTokens[op.typedIndex].text,
        kind: 'wrong',
      });
      refCursor = op.refIndex + 1;
    } else if (op.type === 'delete') {
      words.missed += 1;
      wordDiff.push({
        index: op.refIndex,
        expected: refTokens[op.refIndex].text,
        actual: null,
        kind: 'missed',
      });
      refCursor = op.refIndex + 1;
    } else {
      words.extra += 1;
      wordDiff.push({
        index: refCursor,
        expected: null,
        actual: typedTokens[op.typedIndex].text,
        kind: 'extra',
      });
    }
  }

  const evaluatedWords = typedTokens.length + internalMisses.size;

  return {
    reference,
    typed,
    ops,
    distance,
    typedErrors,
    refLength: n,
    typedLength: m,
    matches,
    substitutions,
    deletions,
    insertions,
    words,
    wordDiff,
    evaluatedWords,
  };
}

function itemsFromOps(ops: AlignmentOp[]): DisplayItem[] {
  return ops.map((op) => {
    switch (op.type) {
      case 'equal':
        return {
          ch: op.ch,
          state: 'correct',
          refIndex: op.refIndex,
          typedIndex: op.typedIndex,
        };
      case 'substitute':
        return {
          ch: op.typedCh,
          state: 'wrong',
          refIndex: op.refIndex,
          typedIndex: op.typedIndex,
          expected: op.refCh,
        };
      case 'delete':
        return { ch: op.ch, state: 'missed', refIndex: op.refIndex };
      case 'insert':
        return { ch: op.ch, state: 'extra', typedIndex: op.typedIndex };
    }
  });
}

export function buildDisplayItems(alignment: AlignmentResult): DisplayItem[] {
  return itemsFromOps(alignment.ops);
}

export type LiveCharState = 'correct' | 'wrong' | 'current' | 'untyped';

export type LiveChar = {
  ch: string;
  state: LiveCharState;
};

export function buildLiveChars(
  reference: string,
  typed: string
): { chars: LiveChar[]; extras: string } {
  const chars: LiveChar[] = [];

  for (let i = 0; i < reference.length; i += 1) {
    if (i < typed.length) {
      chars.push({
        ch: reference[i],
        state: typed[i] === reference[i] ? 'correct' : 'wrong',
      });
    } else if (i === typed.length) {
      chars.push({ ch: reference[i], state: 'current' });
    } else {
      chars.push({ ch: reference[i], state: 'untyped' });
    }
  }

  const extras =
    typed.length > reference.length ? typed.slice(reference.length) : '';

  return { chars, extras };
}

export function scoreFromAlignment(
  alignment: AlignmentResult,
  elapsedMs: number
): ScoreResult {
  const r = alignment.refLength;
  const t = alignment.typedLength;

  const accuracy =
    alignment.words.total === 0 && alignment.evaluatedWords === 0
      ? 100
      : alignment.evaluatedWords === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              100,
              Math.floor((alignment.words.correct / alignment.evaluatedWords) * 100)
            )
          );

  const completion =
    r === 0
      ? t === 0 ? 100 : 0
      : Math.max(
          0,
          Math.min(
            100,
            Math.floor(((r - alignment.deletions) / r) * 100)
          )
        );

  const elapsed = Math.max(0, elapsedMs);
  const minutes = elapsed / 60_000;
  const scored =
    elapsed >= MIN_SCORED_ELAPSED_MS &&
    t >= MIN_SCORED_TYPED_CHARS;

  const exactWpm = scored && minutes > 0 ? t / 5 / minutes : 0;
  const rawWpm = Math.round(exactWpm);
  const netWpm = Math.round((exactWpm * accuracy) / 100);

  return {
    typed: t,
    correct: alignment.matches,
    errors: alignment.typedErrors,
    accuracy,
    completion,
    wpm: netWpm,
    rawWpm,
    netWpm,
    elapsedMs: elapsed,
    scored,
    words: alignment.words,
    alignment,
  };
}

export function computeScore(
  reference: string,
  typed: string,
  elapsedMs: number
): ScoreResult {
  return scoreFromAlignment(align(reference, typed), elapsedMs);
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatElapsed(ms: number): string {
  return formatClock(ms / 1000);
}

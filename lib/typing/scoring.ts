/**
 * Typing engine — authoritative scoring, alignment and comparison.
 *
 * Normalization policy:
 *   - runs of whitespace collapse to a single space
 *   - leading / trailing whitespace is ignored
 *   - word matching is case-sensitive
 *   - punctuation is its own scored item (not glued to the word)
 *
 * Scoring model (single token alignment for scoring + review):
 *   - Text is tokenized into word tokens and punctuation tokens.
 *     A word token is [A-Za-z0-9]+ with internal ' or - between
 *     alphanumerics (so "don't" and "cross-examination" stay whole).
 *     A punctuation token is a run of non-alphanumeric, non-space
 *     characters (so "evening." -> "evening" + ".").
 *   - Words and punctuation are aligned together in one
 *     start-anchored token alignment (exact prefix/suffix trim +
 *     Levenshtein DP). Accuracy, review colors, and
 *     missed/not-reached all derive from this one alignment.
 *   - Character alignment is kept only for completion / errors /
 *     distance (character coverage). It is NOT used to decide
 *     which words were reached — that was the source of the
 *     "colors vs missed words disagree" bug.
 *   - A missed token before a later typed token is "missed"
 *     (skipped). A missed token after the last typed token is
 *     "not reached" (untouched tail) — except trailing
 *     punctuation after the last typed word, which is "missed"
 *     (the user finished the words and omitted the punctuation).
 *     Only missed tokens count in the accuracy denominator;
 *     not-reached tokens count in completion instead.
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

export type TokenKind = 'word' | 'punct';

export type Token = {
  text: string;
  kind: TokenKind;
  start: number;
  end: number;
};

export type TokenAlignmentOp =
  | { type: 'equal'; refIndex: number; typedIndex: number }
  | { type: 'substitute'; refIndex: number; typedIndex: number }
  | { type: 'delete'; refIndex: number }
  | { type: 'insert'; typedIndex: number };

export type TokenStats = {
  /** Reference tokens of this kind in the passage. */
  total: number;
  /** Reference tokens typed exactly (case-sensitive). */
  correct: number;
  /** Reference tokens paired with a different typed token. */
  incorrect: number;
  /** Reference tokens with no paired typed token (skipped + tail). */
  missed: number;
  /** Typed tokens with no paired reference token. */
  extra: number;
};

/**
 * Words-only stats. Kept under the old name for compatibility;
 * punctuation now lives in `punctuation` / `items` instead of
 * being glued onto words.
 */
export type WordStats = TokenStats;

export type DisplayItem = {
  ch: string;
  state: CharState;
  refIndex?: number;
  typedIndex?: number;
  expected?: string;
};

export type WordDiffKind = 'wrong' | 'missed' | 'extra';

export type TokenDiffEntry = {
  /** 0-based reference token position; length means after the last token. */
  index: number;
  expected: string | null;
  actual: string | null;
  kind: WordDiffKind;
  tokenKind: TokenKind;
};

export type AlignmentResult = {
  reference: string;
  typed: string;
  /** Character-level ops (completion / errors only — not for review reach). */
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
  /** Words-only stats (punctuation excluded). */
  words: WordStats;
  /** Punctuation-only stats. */
  punctuation: TokenStats;
  /** Combined words + punctuation stats (drives accuracy). */
  items: TokenStats;
  /** Token-level diffs (words + punctuation). */
  tokenDiff: TokenDiffEntry[];
  /** Reference scored tokens (words + punctuation) with char offsets. */
  refTokens: Token[];
  /** Typed scored tokens with char offsets. */
  typedTokens: Token[];
  /** Start-anchored token alignment (single source for scoring + review). */
  tokenOps: TokenAlignmentOp[];
  /**
   * Items included in accuracy: all typed tokens plus skipped
   * reference tokens before later typed tokens. The untouched
   * reference tail is out.
   */
  evaluatedItems: number;
};

export type ScoreResult = {
  /** Normalized typed character count, including spaces and punctuation. */
  typed: number;
  /** Characters that matched exactly. */
  correct: number;
  /** Unresolved character edits in the attempted portion. */
  errors: number;
  /** Exact attempted-item accuracy, 0–100; untouched tail is excluded. */
  accuracy: number;
  /** Reference characters covered, 0–100. */
  completion: number;
  /** Net WPM alias. */
  wpm: number;
  /** Gross WPM: typed characters / 5 / elapsed minutes. */
  rawWpm: number;
  /** Gross WPM adjusted by attempted-item accuracy. */
  netWpm: number;
  elapsedMs: number;
  /** False when the attempt is too short to score reliably. */
  scored: boolean;
  /** Words-only stats. */
  words: WordStats;
  /** Punctuation-only stats. */
  punctuation: TokenStats;
  /** Combined words + punctuation stats. */
  items: TokenStats;
  alignment: AlignmentResult;
};

/**
 * Minimum attempt before WPM is considered meaningful.
 *
 * `typed chars / elapsed` is mathematically valid but statistically
 * useless over a fraction of a second: two words in one second reads
 * as 108 net WPM with 100% attempted accuracy. The time floor is what
 * blocks those bursts; the character floor only rejects attempts too
 * small to be a typing sample at all. Accuracy is still computed below
 * the floor — only the speed figure is withheld.
 */
export const MIN_SCORED_ELAPSED_MS = 3000;
export const MIN_SCORED_TYPED_CHARS = 10;

/**
 * Hard cap for any reference / typed string fed to align().
 * The character DP is O(n·m); without a cap a very long custom
 * paste can freeze the tab. Custom text is capped at
 * MAX_CUSTOM_CHARS in the UI; this is the engine-level guard.
 */
export const MAX_ALIGN_CHARS = 20000;

/** Maximum custom-text length accepted by the UI (chars, post-sanitize). */
export const MAX_CUSTOM_CHARS = 5000;

export function normalizeText(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Tokenize normalized text into scored tokens.
 * Words keep internal ' and - (don't, cross-examination);
 * punctuation runs become their own tokens (evening. -> evening + .).
 * Spaces are separators and are not scored.
 */
export function tokenizeScored(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*|[^A-Za-z0-9\s]+/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const tokenText = match[0];
    const kind: TokenKind = /[A-Za-z0-9]/.test(tokenText[0])
      ? 'word'
      : 'punct';
    tokens.push({
      text: tokenText,
      kind,
      start: match.index,
      end: match.index + tokenText.length,
    });
  }

  return tokens;
}

/** Count word tokens (alphanumeric chunks) — for the custom-text minimum. */
export function countScoredWords(text: string): number {
  return tokenizeScored(normalizeText(text)).filter(
    (token) => token.kind === 'word'
  ).length;
}

/**
 * Align scored tokens exactly. A substitution represents one wrong
 * token; insertions and deletions do not shift later exact matches.
 * Prefix/suffix trim anchors the alignment to the start, so typed
 * text matches the earliest occurrence, not a later repeat.
 *
 * Substitution cost is kind-aware:
 *   - identical token            -> 0
 *   - same kind (word/word or
 *     punctuation/punctuation)   -> 1
 *   - different kind             -> 2
 *
 * Without the kind penalty, a missing punctuation mark next to a
 * mistyped word tied with a cross-kind substitution and the DP could
 * charge the word to the punctuation slot ("dog. Don't" typed as
 * "dog Dont" reported the period as wrong and "Don't" as missed).
 * Charging 2 makes "delete the punctuation, substitute the word"
 * (1 + 1) strictly cheaper than "substitute the punctuation with the
 * word" (2), which is the attribution a reader expects.
 */
function tokenSubstitutionCost(referenceToken: Token, typedToken: Token): number {
  if (referenceToken.text === typedToken.text) return 0;
  return referenceToken.kind === typedToken.kind ? 1 : 2;
}

function alignTokens(
  reference: Token[],
  typed: Token[]
): TokenAlignmentOp[] {
  const n = reference.length;
  const m = typed.length;
  const ops: TokenAlignmentOp[] = [];

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
          const cost = tokenSubstitutionCost(
            reference[rStart + i],
            typed[tStart + j]
          );
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
        const refToken = reference[rStart + i];
        const typedToken = typed[tStart + j];
        const diagonal = dp[(i + 1) * width + (j + 1)];

        // 1. exact match
        if (refToken.text === typedToken.text && diagonal === here) {
          ops.push({
            type: 'equal',
            refIndex: rStart + i,
            typedIndex: tStart + j,
          });
          i += 1;
          j += 1;
          continue;
        }

        // 2. same-kind substitution (cost 1)
        if (
          refToken.kind === typedToken.kind &&
          diagonal + 1 === here
        ) {
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

      // 3. delete / insert (cost 1) — preferred over a cross-kind
      //    substitution so a word is never charged to punctuation.
      if (i < rn && dp[(i + 1) * width + j] + 1 === here) {
        ops.push({ type: 'delete', refIndex: rStart + i });
        i += 1;
        continue;
      }

      if (j < tn && dp[i * width + j + 1] + 1 === here) {
        ops.push({ type: 'insert', typedIndex: tStart + j });
        j += 1;
        continue;
      }

      // 4. cross-kind substitution (cost 2) — last resort.
      if (i < rn && j < tn) {
        ops.push({
          type: 'substitute',
          refIndex: rStart + i,
          typedIndex: tStart + j,
        });
        i += 1;
        j += 1;
        continue;
      }

      // 5. exhausted on one side.
      if (i < rn) {
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

function emptyStats(): TokenStats {
  return { total: 0, correct: 0, incorrect: 0, missed: 0, extra: 0 };
}

/**
 * Align normalized strings with Levenshtein distance and backtrace.
 * Exact common prefixes and suffixes are matched first.
 *
 * Returns character ops (for completion/errors) plus the single
 * token alignment (for accuracy + review). Throws RangeError if
 * either string exceeds MAX_ALIGN_CHARS.
 */
export function align(
  referenceInput: string,
  typedInput: string
): AlignmentResult {
  const reference = normalizeText(referenceInput);
  const typed = normalizeText(typedInput);

  if (
    reference.length > MAX_ALIGN_CHARS ||
    typed.length > MAX_ALIGN_CHARS
  ) {
    throw new RangeError(
      `align() input exceeds ${MAX_ALIGN_CHARS} characters.`
    );
  }

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

  // ── Single token alignment (scoring + review) ──
  const refTokens = tokenizeScored(reference);
  const typedTokens = tokenizeScored(typed);
  const tokenOps = alignTokens(refTokens, typedTokens);

  const words = emptyStats();
  const punctuation = emptyStats();
  const items = emptyStats();
  const tokenDiff: TokenDiffEntry[] = [];

  for (const token of refTokens) {
    items.total += 1;
    if (token.kind === 'word') words.total += 1;
    else punctuation.total += 1;
  }

  // A skipped reference token is included in accuracy only if a
  // typed token follows it. This excludes the untouched tail.
  // Exception: trailing punctuation after the last typed word is
  // missed (the user finished the words and omitted the punct).
  const internalMisses = new Set<number>();
  let hasTypedTokenAfter = false;

  for (let i = tokenOps.length - 1; i >= 0; i -= 1) {
    const op = tokenOps[i];

    if (op.type === 'delete' && hasTypedTokenAfter) {
      internalMisses.add(op.refIndex);
    }

    if (op.type !== 'delete') {
      hasTypedTokenAfter = true;
    }
  }

  let lastAttemptedTokenIndex = -1;
  let lastWordIndex = -1;

  for (let i = 0; i < refTokens.length; i += 1) {
    if (refTokens[i].kind === 'word') lastWordIndex = i;
  }

  for (const op of tokenOps) {
    if (op.type === 'equal' || op.type === 'substitute') {
      lastAttemptedTokenIndex = Math.max(
        lastAttemptedTokenIndex,
        op.refIndex
      );
    }
  }

  const reachedLastWord =
    typedTokens.length > 0 &&
    lastWordIndex !== -1 &&
    lastAttemptedTokenIndex >= lastWordIndex;

  if (reachedLastWord) {
    for (const op of tokenOps) {
      if (
        op.type === 'delete' &&
        op.refIndex > lastAttemptedTokenIndex &&
        refTokens[op.refIndex].kind === 'punct'
      ) {
        internalMisses.add(op.refIndex);
      }
    }
  }

  let refCursor = 0;

  for (const op of tokenOps) {
    if (op.type === 'equal') {
      const kind = refTokens[op.refIndex].kind;
      items.correct += 1;
      if (kind === 'word') words.correct += 1;
      else punctuation.correct += 1;
      refCursor = op.refIndex + 1;
    } else if (op.type === 'substitute') {
      const kind = refTokens[op.refIndex].kind;
      items.incorrect += 1;
      if (kind === 'word') words.incorrect += 1;
      else punctuation.incorrect += 1;
      tokenDiff.push({
        index: op.refIndex,
        expected: refTokens[op.refIndex].text,
        actual: typedTokens[op.typedIndex].text,
        kind: 'wrong',
        tokenKind: kind,
      });
      refCursor = op.refIndex + 1;
    } else if (op.type === 'delete') {
      const kind = refTokens[op.refIndex].kind;
      items.missed += 1;
      if (kind === 'word') words.missed += 1;
      else punctuation.missed += 1;
      tokenDiff.push({
        index: op.refIndex,
        expected: refTokens[op.refIndex].text,
        actual: null,
        kind: 'missed',
        tokenKind: kind,
      });
      refCursor = op.refIndex + 1;
    } else {
      const kind = typedTokens[op.typedIndex].kind;
      items.extra += 1;
      if (kind === 'word') words.extra += 1;
      else punctuation.extra += 1;
      tokenDiff.push({
        index: refCursor,
        expected: null,
        actual: typedTokens[op.typedIndex].text,
        kind: 'extra',
        tokenKind: kind,
      });
    }
  }

  const evaluatedItems = typedTokens.length + internalMisses.size;

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
    punctuation,
    items,
    tokenDiff,
    refTokens,
    typedTokens,
    tokenOps,
    evaluatedItems,
  };
}

/**
 * Split token diffs into genuinely skipped ("missed") vs untouched
 * tail ("not reached"), using the token alignment only. A missed
 * token at or before the last typed token is missed; after it is
 * not reached — except trailing punctuation after the last typed
 * word, which is missed. Extra/wrong entries are separate.
 */
export function splitMissedNotReached(alignment: AlignmentResult): {
  missed: TokenDiffEntry[];
  notReached: TokenDiffEntry[];
  wrong: TokenDiffEntry[];
  extra: TokenDiffEntry[];
} {
  let lastAttemptedTokenIndex = -1;
  let lastWordIndex = -1;

  for (let i = 0; i < alignment.refTokens.length; i += 1) {
    if (alignment.refTokens[i].kind === 'word') lastWordIndex = i;
  }

  for (const op of alignment.tokenOps) {
    if (op.type === 'equal' || op.type === 'substitute') {
      lastAttemptedTokenIndex = Math.max(
        lastAttemptedTokenIndex,
        op.refIndex
      );
    }
  }

  const reachedLastWord =
    alignment.typedTokens.length > 0 &&
    lastWordIndex !== -1 &&
    lastAttemptedTokenIndex >= lastWordIndex;

  const missed: TokenDiffEntry[] = [];
  const notReached: TokenDiffEntry[] = [];
  const wrong: TokenDiffEntry[] = [];
  const extra: TokenDiffEntry[] = [];

  for (const entry of alignment.tokenDiff) {
    if (entry.kind === 'wrong') wrong.push(entry);
    else if (entry.kind === 'extra') extra.push(entry);
    else if (
      entry.index <= lastAttemptedTokenIndex ||
      (reachedLastWord && entry.tokenKind === 'punct')
    ) {
      missed.push(entry);
    } else {
      notReached.push(entry);
    }
  }

  return { missed, notReached, wrong, extra };
}

/**
 * Token-based display items for the review: exactly the typed
 * text, one entry per typed character (plus single-space
 * separators). A token is either right or wrong — correct tokens
 * are green, wrong and extra typed tokens are red. Nothing else
 * is inserted: missed and not-reached items have no typed chars
 * and are reported via splitMissedNotReached() instead.
 */
export function buildTokenDisplayItems(
  alignment: AlignmentResult
): DisplayItem[] {
  const items: DisplayItem[] = [];
  const { refTokens, typedTokens, tokenOps } = alignment;

  const pushSeparator = (typedToken: (typeof typedTokens)[number]) => {
    // Separator space after this typed token, only when the
    // typed text actually has one (word->punct has none).
    if (
      typedToken.end < alignment.typed.length &&
      alignment.typed[typedToken.end] === ' '
    ) {
      items.push({
        ch: ' ',
        state: 'correct',
        typedIndex: typedToken.end,
      });
    }
  };

  for (const op of tokenOps) {
    if (op.type === 'equal') {
      const refToken = refTokens[op.refIndex];
      const typedToken = typedTokens[op.typedIndex];

      for (let k = 0; k < typedToken.text.length; k += 1) {
        items.push({
          ch: typedToken.text[k],
          state: 'correct',
          refIndex: refToken.start + k,
          typedIndex: typedToken.start + k,
        });
      }

      pushSeparator(typedToken);
    } else if (op.type === 'substitute') {
      const refToken = refTokens[op.refIndex];
      const typedToken = typedTokens[op.typedIndex];

      // The whole word is wrong, so all its chars are red — a
      // partially matching word (e.g. "tribnal" for "tribunal")
      // must never look green.
      for (let k = 0; k < typedToken.text.length; k += 1) {
        items.push({
          ch: typedToken.text[k],
          state: 'wrong',
          refIndex: refToken.start + k,
          typedIndex: typedToken.start + k,
          expected: refToken.text,
        });
      }

      pushSeparator(typedToken);
    } else if (op.type === 'insert') {
      const typedToken = typedTokens[op.typedIndex];

      // Extras are red like wrong tokens, but tagged 'extra' so the
      // review can mark them as insertions. Otherwise a reader counts
      // red tokens and compares them with the table's "Wrong" column,
      // which counts substitutions only.
      for (let k = 0; k < typedToken.text.length; k += 1) {
        items.push({
          ch: typedToken.text[k],
          state: 'extra',
          typedIndex: typedToken.start + k,
        });
      }

      pushSeparator(typedToken);
    }
    // deletes (missed tokens) contribute no typed chars.
  }

  return items;
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
    alignment.items.total === 0 && alignment.evaluatedItems === 0
      ? 100
      : alignment.evaluatedItems === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              100,
              Math.floor(
                (alignment.items.correct / alignment.evaluatedItems) * 100
              )
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
    punctuation: alignment.punctuation,
    items: alignment.items,
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



/**
 * Reference-side display items for the finished run.
 *
 * The live indicator colours the passage positionally (char i vs typed
 * char i), which is right while typing but disagrees with the result
 * table: one missing character shifts every colour after it, so the
 * screen shows a wall of red while the table reports most words
 * correct. Once the run is finished we colour the reference from the
 * SAME token alignment the table uses, so a token is green exactly
 * when it counts as correct, red exactly when it counts as wrong, and
 * amber exactly when it counts as missed.
 *
 * Concatenating the returned items reproduces the reference text
 * exactly (extras are not part of the reference; they are shown in the
 * "your typing" block instead).
 */
export function buildReferenceDisplayItems(
  alignment: AlignmentResult
): DisplayItem[] {
  const stateByRefIndex = new Map<number, CharState>();

  for (const op of alignment.tokenOps) {
    if (op.type === 'equal') stateByRefIndex.set(op.refIndex, 'correct');
    else if (op.type === 'substitute') {
      stateByRefIndex.set(op.refIndex, 'wrong');
    } else if (op.type === 'delete') {
      stateByRefIndex.set(op.refIndex, 'missed');
    }
  }

  const items: DisplayItem[] = [];
  const { refTokens, reference } = alignment;

  refTokens.forEach((token, refIndex) => {
    // Every reference token is consumed exactly once by tokenOps, so
    // the fallback is only a safety net.
    const state: CharState = stateByRefIndex.get(refIndex) ?? 'missed';

    for (let k = 0; k < token.text.length; k += 1) {
      items.push({
        ch: token.text[k],
        state,
        refIndex: token.start + k,
      });
    }

    // Separator space, only when the reference actually has one.
    if (token.end < reference.length && reference[token.end] === ' ') {
      items.push({
        ch: ' ',
        state: state === 'missed' ? 'missed' : 'correct',
        refIndex: token.end,
      });
    }
  });

  return items;
}

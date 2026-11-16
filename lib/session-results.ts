'use client';

/**
 * Session-only results store.
 *
 * Results survive client-side navigation for this browser visit and are
 * cleared by a full refresh or tab close.
 */

export type SessionResult = {
  id: string;
  practice: string;
  category: 'General' | 'Legal' | 'Professional' | 'Mixed' | 'Custom';
  /** Net WPM; kept as `wpm` for existing consumers. */
  wpm: number;
  /** Explicit alias for net WPM. */
  netWpm: number;
  /** Gross WPM before the accuracy adjustment. */
  rawWpm: number;
  /** Exact attempted-item accuracy; untouched passage tail is excluded. */
  accuracy: number;
  /** How much of the reference was covered (0–100). */
  completion: number;
  correctWords: number;
  incorrectWords: number;
  /** All unwritten words — skipped mid-passage plus the untouched tail. */
  missedWords: number;
  extraWords: number;
  totalWords: number;
  correctPunct: number;
  incorrectPunct: number;
  /** All unwritten punctuation — skipped plus the untouched tail. */
  missedPunct: number;
  extraPunct: number;
  totalPunct: number;
  /** Whether the attempt met the minimum scoring thresholds. */
  scored: boolean;
  duration: string;
  date: string;
  mode: 'free' | 'dictation' | 'custom';
  /** True only for a scored blind run. */
  counted: boolean;
};

const MAX_RESULTS = 5;

let results: SessionResult[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function addSessionResult(result: SessionResult) {
  results = [result, ...results].slice(0, MAX_RESULTS);
  emit();
}

export function getSessionResults(): SessionResult[] {
  return results;
}

export function clearSessionResults() {
  results = [];
  emit();
}

export function subscribeSessionResults(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const SESSION_RESULT_LIMIT = MAX_RESULTS;


'use client';

/**
 * Session-only results store.
 *
 * Results live in memory for the current browser visit only.
 * They survive client-side navigation between pages (typing →
 * results) but are wiped on a full page refresh or tab close.
 *
 * This is intentional until the database is connected — the UI
 * explicitly tells students that results are not stored.
 */

export type SessionResult = {
  id: string;
  practice: string;
  category: 'General' | 'Legal' | 'Professional';
  wpm: number;
  accuracy: number;
  errors: number;
  duration: string;
  date: string;
  mode: 'free' | 'dictation' | 'custom';
  counted: boolean;
};

const MAX_RESULTS = 5;

let results: SessionResult[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
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

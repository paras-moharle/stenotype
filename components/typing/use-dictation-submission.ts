import { useEffect, useState } from 'react';
import type { ScoreResult } from '@/lib/typing/scoring';

type RecordedScore = Pick<ScoreResult, 'accuracy' | 'completion' | 'netWpm' | 'rawWpm' | 'scored' | 'words' | 'punctuation'>;
type RecordedAttempt = { attemptId: string; reference: string; score: RecordedScore };
type Submission = { submissionKey: string; passageId: string; typed: string; elapsedMs: number };
type Settlement = {
  submission: Submission;
  retry: number;
  result?: RecordedAttempt;
  error?: string;
};

export function useDictationSubmission(submission: Submission | null) {
  const [retry, setRetry] = useState(0);
  const [settled, setSettled] = useState<Settlement | null>(null);

  useEffect(() => {
    if (!submission) return;
    const controller = new AbortController();

    async function submit(attempt: Submission) {
      try {
        const response = await fetch('/api/attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attempt),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok || !payload?.attemptId || !payload?.reference || !payload?.score) {
          setSettled({ submission: attempt, retry, error: response.status === 401 ? 'Your session expired. Sign in in another tab, then retry here.' : payload?.error ?? 'Could not score this attempt.' });
          return;
        }
        setSettled({ submission: attempt, retry, result: payload });
      } catch {
        if (!controller.signal.aborted) {
          setSettled({ submission: attempt, retry, error: 'Could not reach the scoring service. Please try again.' });
        }
      }
    }

    void submit(submission);
    return () => controller.abort();
  }, [submission, retry]);

  const current = settled?.submission === submission && settled?.retry === retry ? settled : null;
  return {
    result: current?.result,
    error: current?.error,
    pending: Boolean(submission && !current),
    retry: () => setRetry((count) => count + 1),
  };
}

// getRandomValues also works on a trusted local network over plain HTTP.
export function createSubmissionKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

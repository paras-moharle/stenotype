import { useEffect, useState } from 'react';
import type { ScoreResult } from '@/lib/typing/scoring';

type RecordedScore = Pick<ScoreResult, 'accuracy' | 'completion' | 'netWpm' | 'rawWpm' | 'scored' | 'words' | 'punctuation'>;
type RecordedAttempt = { attemptId: string; reference: string; score: RecordedScore };
export type PracticeTicket = { submissionKey: string; practiceTicket: string };
type Submission = PracticeTicket & { passageId: string; typed: string; elapsedMs: number };
type Settlement = {
  submission: Submission;
  retry: number;
  result?: RecordedAttempt;
  error?: string;
  revisionUnavailable?: boolean;
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
          setSettled({
            submission: attempt, retry,
            error: response.status === 401 ? 'Your session expired. Sign in in another tab, then retry here.' : payload?.error ?? 'Could not score this attempt.',
            revisionUnavailable: payload?.code === 'PRACTICE_UNAVAILABLE' || payload?.code === 'PRACTICE_SUPERSEDED',
          });
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
    revisionUnavailable: current?.revisionUnavailable ?? false,
    pending: Boolean(submission && !current),
    retry: () => setRetry((count) => count + 1),
  };
}

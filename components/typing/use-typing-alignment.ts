import { useEffect, useMemo, useRef, useState } from 'react';
import { align, type AlignmentResult } from '@/lib/typing/scoring';

type Input = { reference: string; typed: string };
type Answer = { alignment?: AlignmentResult; error?: 'budget' | 'worker' };

function compute(input: Input): Answer {
  try {
    return { alignment: align(input.reference, input.typed) };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return { error: 'budget' };
  }
}

export function useTypingAlignment(reference: string, typed: string, enabled: boolean, finished: boolean) {
  const input = useMemo(() => enabled && reference ? { reference, typed } : null, [enabled, reference, typed]);
  const offload = Boolean(input && reference.length * typed.length > 300_000);
  const immediate = useMemo(() => input && !offload ? compute(input) : undefined, [input, offload]);
  const [answer, setAnswer] = useState<{ input: Input; answer: Answer }>();
  const [unavailable, setUnavailable] = useState(false);
  const enqueue = useRef<((input: Input | null) => void) | null>(null);

  useEffect(() => {
    if (!offload || unavailable) return;
    let worker: Worker;
    try {
      worker = new Worker(new URL('./alignment.worker.ts', import.meta.url));
    } catch {
      const timer = setTimeout(() => setUnavailable(true), 0);
      return () => clearTimeout(timer);
    }

    let active: { id: number; input: Input } | null = null;
    let latest: Input | null = null;
    let id = 0;
    const pump = () => {
      if (active || !latest) return;
      active = { id: ++id, input: latest };
      latest = null;
      worker.postMessage({ id: active.id, ...active.input });
    };
    enqueue.current = (input) => {
      latest = input;
      pump();
    };
    worker.onmessage = ({ data }: MessageEvent<Answer & { id: number }>) => {
      if (!active || active.id !== data.id) return;
      setAnswer({ input: active.input, answer: data });
      active = null;
      pump();
    };
    worker.onerror = () => setUnavailable(true);
    return () => {
      enqueue.current = null;
      worker.terminate();
    };
  }, [offload, unavailable]);

  useEffect(() => {
    if (!offload || !input) return;
    if (!unavailable) {
      enqueue.current?.(input);
      return;
    }
    if (!finished) return;
    // A missing worker never blocks live input with a large alignment.
    const timer = setTimeout(() => setAnswer({ input, answer: compute(input) }), 0);
    return () => clearTimeout(timer);
  }, [finished, input, offload, unavailable]);

  const exact = immediate ?? (answer?.input === input ? answer?.answer : undefined);
  const previous = !finished && offload && answer?.input.reference === reference &&
    Math.abs(answer.input.typed.length - typed.length) <= 64
    ? answer?.answer.alignment
    : undefined;
  return {
    alignment: exact?.alignment ?? previous ?? null,
    pending: Boolean(input && offload && !exact && (!unavailable || finished)),
    error: exact?.error,
  };
}

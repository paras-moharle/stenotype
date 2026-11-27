import { useCallback, useEffect, useState } from 'react';
import { finishTime, typingDeadline } from '@/lib/typing/clock';

export function useTypingClock(running: boolean, duration: number, timed: boolean, onFinish: () => void) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(0);
  const deadline = typingDeadline(startedAt, duration, timed);
  const elapsedMs = startedAt === null
    ? 0
    : Math.max(0, Math.round((finishedAt ?? clockNow) - startedAt));

  const reset = useCallback(() => {
    setStartedAt(null);
    setFinishedAt(null);
    setClockNow(0);
  }, []);

  const start = useCallback(() => {
    const now = performance.now();
    setStartedAt(now);
    setClockNow(now);
    setFinishedAt(null);
  }, []);

  const finish = useCallback((at = performance.now()) => {
    setFinishedAt((previous) => previous ?? finishTime(at, deadline));
    onFinish();
  }, [deadline, onFinish]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const now = performance.now();
      if (deadline !== null && now >= deadline) {
        finish(deadline);
      } else {
        setClockNow(now);
      }
    };
    const timer = window.setInterval(tick, 250);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [deadline, finish, running]);

  return { deadline, elapsedMs, finish, reset, start };
}

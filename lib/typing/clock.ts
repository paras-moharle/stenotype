export function typingDeadline(startedAt: number | null, durationSeconds: number, timed: boolean) {
  return timed && startedAt !== null ? startedAt + durationSeconds * 1_000 : null;
}

export function finishTime(now: number, deadline: number | null) {
  return deadline === null ? now : Math.min(now, deadline);
}

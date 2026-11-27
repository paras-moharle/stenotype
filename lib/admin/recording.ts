/** A duration describes one recording, so changing the video invalidates it. */
export function nextRecordingDuration(
  currentVideo: string | null,
  video: string | null | undefined,
  durationSeconds: number | null | undefined,
): number | null | undefined {
  const nextVideo = video === undefined ? currentVideo : video;
  if (durationSeconds !== undefined) return nextVideo ? durationSeconds : null;
  return nextVideo === currentVideo ? undefined : null;
}

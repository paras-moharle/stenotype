/**
 * `publishedAt` transition rules.
 *
 * Previously every PUT on a published dictation reset `publishedAt` to
 * "now", so simply fixing a typo rewrote the publish date. And
 * unpublishing never cleared it.
 *
 * Rules:
 *   - publishing a draft      -> stamp now
 *   - editing a published one -> keep the original publish date
 *   - back to draft           -> clear it
 *   - archived                -> keep it (history stays truthful)
 */

export type PublishableStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export function nextPublishedAt(
  current: Date | null,
  next: PublishableStatus,
  now: Date = new Date()
): Date | null {
  if (next === 'PUBLISHED') return current ?? now;
  if (next === 'DRAFT') return null;
  return current;
}

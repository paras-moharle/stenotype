/**
 * Date/time display — one place, one timezone.
 *
 * The app is for Indian students, so every timestamp is rendered in
 * Asia/Kolkata regardless of the viewer's device timezone. Keeping the
 * formatter here stops screens from drifting apart (some used the
 * browser zone, some IST) and keeps server and client output identical,
 * which avoids hydration mismatches.
 *
 * The database stores absolute instants (`timestamptz`), so formatting
 * is the only place a timezone is applied.
 */

export const IST_TIME_ZONE = 'Asia/Kolkata';

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** e.g. "20 Nov 2026" (IST). */
export function formatISTDate(value: Date | string): string {
  return dateFormatter.format(toDate(value));
}

/** e.g. "20 Nov 2026, 9:30 pm" (IST). */
export function formatISTDateTime(value: Date | string): string {
  return dateTimeFormatter.format(toDate(value));
}

/**
 * Shared paging for admin list endpoints.
 *
 * The admin tables load everything today, which is fine at a few dozen
 * rows and unbounded at a few thousand. Every list endpoint now accepts
 * `?limit=` (1–200, default 100) and `?offset=` (default 0), and returns
 * a `page` block so a caller can walk the list.
 */
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 200;

export type PageParams = {
  /** Rows to fetch. Callers fetch `take + 1` to detect another page. */
  take: number;
  skip: number;
  limit: number;
  offset: number;
  hasMore: (rows: unknown[]) => boolean;
};

const integer = (value: string | null, fallback: number): number => {
  if (value === null || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
};

export function parsePageParams(request: Request): PageParams {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(
    Math.max(integer(params.get('limit'), DEFAULT_PAGE_SIZE), 1),
    MAX_PAGE_SIZE
  );
  const offset = Math.min(10_000, Math.max(integer(params.get('offset'), 0), 0));

  return {
    take: limit,
    skip: offset,
    limit,
    offset,
    hasMore: (rows) => rows.length > limit,
  };
}

/** Drop the look-ahead row used to detect `hasMore`. */
export function pageSlice<T>(rows: T[], page: PageParams): T[] {
  return page.hasMore(rows) ? rows.slice(0, page.take) : rows;
}

export function parsePageNumber(value: string | string[] | undefined) {
  return Math.min(1_000, Math.max(1, integer(typeof value === 'string' ? value : null, 1)));
}

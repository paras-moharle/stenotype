import { useEffect, useState } from 'react';

const PAGE_SIZE = 25;
const LAST_PAGE = 400;

export function useAdminList<Row>(resource: 'students' | 'dictations') {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [settled, setSettled] = useState<{
    key: string;
    rows: Row[];
    more: boolean;
    error?: string;
  }>();
  const key = JSON.stringify([query, page, revision]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({
        q: query,
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
      });
      try {
        const response = await fetch(`/api/admin/${resource}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) {
          setSettled({ key, rows: data[resource], more: data.page.hasMore });
        }
      } catch {
        if (!controller.signal.aborted) {
          setSettled({ key, rows: [], more: false, error: `Failed to load ${resource}.` });
        }
      }
    }, query ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, page, query, resource]);

  const current = settled?.key === key ? settled : undefined;
  return {
    query,
    changeQuery(value: string) {
      setQuery(value);
      setPage(1);
    },
    page,
    setPage,
    rows: current?.rows ?? [],
    more: Boolean(current?.more && page < LAST_PAGE),
    loading: !current,
    error: current?.error,
    reload: () => setRevision((value) => value + 1),
  };
}

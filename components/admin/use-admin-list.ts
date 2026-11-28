import { useEffect, useRef, useState } from 'react';

import { ADMIN_PAGE_SIZE } from '@/lib/pagination';
const LAST_PAGE = 400;

export type AdminListSeed<Row> = { rows: Row[]; more: boolean };

const initialScope = JSON.stringify(['', '', '', 1]);
const initialKey = JSON.stringify([initialScope, 0]);

export function useAdminList<Row>(resource: 'students' | 'dictations', initial: AdminListSeed<Row>) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [settled, setSettled] = useState<{
    key: string;
    scope: string;
    rows: Row[];
    more: boolean;
    error?: string;
  }>(() => ({ ...initial, scope: initialScope, key: initialKey }));
  const seeded = useRef(true);
  const scope = JSON.stringify([query, status, category, page]);
  const key = JSON.stringify([scope, revision]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (seeded.current && key === initialKey) return;
    seeded.current = false;
    if (query !== debouncedQuery) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({
        q: query,
        status,
        category,
        limit: String(ADMIN_PAGE_SIZE),
        offset: String((page - 1) * ADMIN_PAGE_SIZE),
      });
      try {
        const response = await fetch(`/api/admin/${resource}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) {
          if (page > 1 && data[resource].length === 0) {
            setPage(page - 1);
            return;
          }
          setSettled({ key, scope, rows: data[resource], more: data.page.hasMore });
        }
      } catch {
        if (!controller.signal.aborted) {
          setSettled({ key, scope, rows: [], more: false, error: `Failed to load ${resource}.` });
        }
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, scope, page, query, debouncedQuery, resource, status, category]);

  const current = settled?.scope === scope ? settled : undefined;
  return {
    query,
    status,
    category,
    changeCategory(value: string) { setCategory(value); setPage(1); },
    changeStatus(value: string) { setStatus(value); setPage(1); },
    changeQuery(value: string) {
      setQuery(value);
      setPage(1);
    },
    page,
    setPage,
    rows: current?.rows ?? [],
    more: Boolean(current?.more && page < LAST_PAGE),
    loading: !current,
    refreshing: Boolean(current && current.key !== key),
    error: current?.error,
    reload: () => setRevision((value) => value + 1),
  };
}

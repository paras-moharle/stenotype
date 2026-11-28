'use client';

import { useEffect, useState } from 'react';
import { ADMIN_PAGE_SIZE } from '@/lib/pagination';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminFilterToolbar } from '@/components/admin/admin-filter-toolbar';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminListPagination } from '@/components/admin/admin-list-pagination';
import { ChoiceMenu } from '@/components/ui/choice-menu';
import { Button } from '@/components/ui/button';
import { formatISTDateTime } from '@/lib/datetime';

type Login = { id: string; email: string; createdAt: string; success: boolean; ipAddress: string | null };

export function LoginHistoryClient({ student, initial }: { student?: string; initial: { rows: Login[]; more: boolean } }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [initialView, setInitialView] = useState(true);
  const [response, setResponse] = useState<{ key: string; rows: Login[]; more: boolean; error?: string }>();
  const params = new URLSearchParams({ page: String(page), email: query, success: status, limit: String(ADMIN_PAGE_SIZE) });
  if (student) params.set('student', student);
  const url = '/api/admin/login-history?' + params;
  const key = url + '#' + retry;

  const showInitial = initialView;
  useEffect(() => {
    if (showInitial) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async (result) => {
      if (!result.ok) throw new Error(result.status === 401 ? 'Your session has expired. Sign in again.' : 'Login history could not be loaded.');
      const data = await result.json();
      if (!controller.signal.aborted) setResponse({ key, rows: data.attempts, more: data.pagination.page < data.pagination.totalPages });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResponse({ key, rows: [], more: false, error: error instanceof Error ? error.message : 'Login history could not be loaded.' });
    });
    return () => controller.abort();
  }, [url, key, showInitial]);

  const data = showInitial ? { ...initial, error: undefined } : response?.key === key ? response : undefined;
  return (
    <div className="space-y-6">
      <AdminHeader title="Login history" description="Review authentication events recorded for this workspace." />
      <form onSubmit={(event) => {
        event.preventDefault(); setInitialView(false); setQuery(search.trim()); setPage(1);
      }}>
        <AdminFilterToolbar>
          <input type="search" className="field" placeholder="Search by email…" aria-label="Search by email" value={search} onChange={(event) => setSearch(event.target.value)} />
          <ChoiceMenu label="Outcome" value={status || 'all'} options={[
            { value: 'all', label: 'All events' }, { value: 'true', label: 'Successful' }, { value: 'false', label: 'Failed' },
          ]} onChange={value => { setInitialView(false); setStatus(value === 'all' ? '' : value); setPage(1); }} />
          <Button type="submit" className="min-h-[46px]">Search</Button>
        </AdminFilterToolbar>
      </form>
      {!data ? <p role="status">Loading login history…</p> : data.error ? (
        <div role="alert" className="panel space-y-3 p-4"><p>{data.error}</p><Button variant="outline" onClick={() => setRetry(retry + 1)}>Retry</Button></div>
      ) : data.rows.length === 0 ? <p role="status" className="panel p-5">No login events match these filters.</p> : (
        <AdminTable rows={data.rows} rowKey={(row) => row.id} columns={[
          { key: 'email', header: 'Account', render: (row) => row.email },
          { key: 'time', header: 'Date and time', render: (row) => formatISTDateTime(row.createdAt) },
          { key: 'status', header: 'Outcome', render: (row) => <span className={`badge ${row.success ? 'badge-success' : 'badge-danger'}`}>{row.success ? 'Successful' : 'Failed'}</span> },
          { key: 'ip', header: 'IP address', render: (row) => row.ipAddress ?? '—' },
        ]} />
      )}
      <AdminListPagination page={page} more={data?.more ?? false} onPage={value => { setInitialView(false); setPage(value); }} />
    </div>
  );
}

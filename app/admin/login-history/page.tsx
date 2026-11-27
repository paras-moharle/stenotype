'use client';

import { useEffect, useState } from 'react';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminListPagination } from '@/components/admin/admin-list-pagination';
import { ChoiceMenu } from '@/components/ui/choice-menu';
import { Button } from '@/components/ui/button';
import { formatISTDateTime } from '@/lib/datetime';

type Login = { id: string; email: string; createdAt: string; success: boolean; ipAddress: string | null };

export default function LoginHistoryPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [response, setResponse] = useState<{ key: string; rows: Login[]; more: boolean; error?: string }>();
  const params = new URLSearchParams({ page: String(page), email: query, success: status });
  const url = '/api/admin/login-history?' + params;
  const key = url + '#' + retry;

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async (result) => {
      if (!result.ok) throw new Error(result.status === 401 ? 'Your session has expired. Sign in again.' : 'Login history could not be loaded.');
      const data = await result.json();
      if (!controller.signal.aborted) setResponse({ key, rows: data.attempts, more: data.pagination.page < data.pagination.totalPages });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResponse({ key, rows: [], more: false, error: error instanceof Error ? error.message : 'Login history could not be loaded.' });
    });
    return () => controller.abort();
  }, [url, key]);

  const data = response?.key === key ? response : undefined;
  return (
    <div className="space-y-6">
      <AdminHeader title="Login history" description="Review authentication events recorded for this workspace." />
      <form className="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]" onSubmit={(event) => {
        event.preventDefault(); setQuery(search.trim()); setPage(1);
      }}>
        <label><span className="field-label">Email</span><input type="search" className="field h-[46px]" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div><span className="field-label">Outcome</span>
          <ChoiceMenu label="Outcome" value={status || 'all'} options={[
            { value: 'all', label: 'All events' }, { value: 'true', label: 'Successful' }, { value: 'false', label: 'Failed' },
          ]} onChange={value => { setStatus(value === 'all' ? '' : value); setPage(1); }} />
        </div>
        <Button type="submit" className="h-[46px]">Search</Button>
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
      <AdminListPagination page={page} more={data?.more ?? false} onPage={setPage} />
    </div>
  );
}

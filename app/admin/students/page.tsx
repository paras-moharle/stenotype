'use client';

import { Modal } from '@/components/ui/modal';

import { useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { useAdminList } from '@/components/admin/use-admin-list';
import { AdminListPagination } from '@/components/admin/admin-list-pagination';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminSearch } from '@/components/admin/admin-search';
import { AdminEmptyState } from '@/components/admin/admin-empty-state';
import { Button } from '@/components/ui/button';

type Student = {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    banned: boolean;
  };
  phone: string | null;
  status: string;

  _count: {
    typingAttempts: number;
  };
  createdAt: string;
};

type FormState = {
  name: string;
  email: string;
  password: string;
  phone: string;
};

const blankForm: FormState = {
  name: '',
  email: '',
  password: '',
  phone: '',
};

export default function AdminStudentsPage() {
  const list = useAdminList<Student>('students');
  const { query, rows: filtered, loading } = list;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [pending, setPending] = useState(false);

  function dismissCreate() {
    if (pending) return;
    setShowForm(false);
  }

  function dismissManage() {
    if (pending) return;
    setEditing(null);
  }

  const [toast, setToast] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create student');
      }

      setToast('Student created successfully');
      setShowForm(false);
      setForm(blankForm);
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create student');
    } finally { setPending(false); }
  };

  const handleAccount = async (student: Student, action: 'ban' | 'revoke' | 'update') => {
    if (pending) return;
    if (action === 'ban' && !student.user.banned && !window.confirm(`Block ${student.user.name} from signing in?`)) return;
    if (action === 'revoke' && !window.confirm(`Sign out ${student.user.name} from all sessions?`)) return;
    setPending(true);
    setError(null);
    try {
      const endpoint = action === 'update' ? `/api/admin/students/${student.id}`
        : `/api/admin/users/${student.user.id}/${action === 'ban' ? 'ban' : 'revoke-sessions'}`;
      const payload = action === 'update'
        ? { name: student.user.name, phone: student.phone || null, status: student.status }
        : action === 'ban' ? { banned: !student.user.banned } : undefined;
      const response = await fetch(endpoint, {
        method: action === 'update' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'The account could not be updated.');
      setToast(action === 'revoke' ? (data?.revoked ? 'Session revoked.' : 'No active session to revoke.') : 'Account updated.');
      setEditing(null);
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The account could not be updated.');
    } finally { setPending(false); }
  };

  const handleDelete = async (student: Student) => {
    if (pending || !confirm(`Delete ${student.user.name}? This cannot be undone.`)) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${student.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to delete student');
      }

      setToast('Student deleted');
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student');
    } finally { setPending(false); }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (s: Student) => (
        <div>
          <div className="font-medium">{s.user.name}</div>
          <div className="text-sm text-muted-foreground">{s.user.email}</div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (s: Student) => s.phone ?? '—',
    },
    {
      key: 'attempts',
      header: 'Attempts',
      render: (s: Student) => (
        <span className="font-mono tabular-nums">{s._count.typingAttempts}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s: Student) => {
        if (s.user.banned) {
          return <span className="badge badge-danger">Blocked</span>;
        }
        const label =
          s.status === 'SUSPENDED'
            ? 'Suspended'
            : s.status === 'INACTIVE'
              ? 'Inactive'
              : 'Active';
        return (
          <span
            className={
              s.status === 'ACTIVE'
                ? 'badge badge-success'
                : 'badge badge-warning'
            }
          >
            {label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (s: Student) => (
        <div className="flex gap-2">
          <Button variant="outline" disabled={pending} onClick={() => { setError(null); setEditing(s); }}>Manage</Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => handleDelete(s)}
            disabled={pending}
            aria-label={`Delete ${s.user.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Students"
        description="Manage student accounts"
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        }
      />

      <AdminSearch
        value={query}
        onChange={list.changeQuery}
        placeholder="Search students..."
      />

      {error && !showForm && !editing && (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {toast && (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-success">
          {toast}
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-success hover:text-success"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Loading students...
        </div>
      ) : list.error ? (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{list.error}</p>
          <Button variant="outline" size="sm" onClick={list.reload}>Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title={query ? 'No matching students' : 'No students yet'}
          description={
            query
              ? 'Try a different name or email.'
              : 'Create the first student account with their details.'
          }
          action={
            query ? undefined : (
              <Button onClick={() => setShowForm(true)}>
                Add student
              </Button>
            )
          }
        />
      ) : (
        <AdminTable
          columns={columns}
          rows={filtered}
          rowKey={(s) => s.id}
        />
      )}

      <AdminListPagination page={list.page} more={list.more} onPage={list.setPage} />

      {editing && (
        <Modal title="Manage student" onClose={dismissManage}>
          <form className="space-y-5 p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); void handleAccount(editing, 'update'); }}>
            <div><h2 className="text-h2 font-semibold">Manage student</h2><p className="text-sm text-muted-foreground">{editing.user.email}</p></div>
            <label className="block"><span className="field-label">Name</span><input className="field" required value={editing.user.name}
              onChange={(event) => setEditing({ ...editing, user: { ...editing.user, name: event.target.value } })} /></label>
            <label className="block"><span className="field-label">Phone</span><input className="field" type="tel" value={editing.phone ?? ''}
              onChange={(event) => setEditing({ ...editing, phone: event.target.value })} /></label>
            <label className="block"><span className="field-label">Status</span><select className="field" value={editing.status}
              onChange={(event) => setEditing({ ...editing, status: event.target.value })}>
              <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option>
            </select></label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>{pending ? 'Working…' : 'Save changes'}</Button>
              <Button type="button" variant="outline" disabled={pending} onClick={dismissManage}>Cancel</Button>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" disabled={pending} onClick={() => handleAccount(editing, 'revoke')}>Revoke session</Button>
              <Button type="button" variant={editing.user.banned ? 'outline' : 'destructive'} disabled={pending} onClick={() => handleAccount(editing, 'ban')}>
                {editing.user.banned ? 'Unblock' : 'Block account'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {showForm && (
        <Modal title="Add student" onClose={dismissCreate}>
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Student</h2>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="Close add student dialog"
                disabled={pending}
                onClick={dismissCreate}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div>
                <label htmlFor="student-name" className="field-label">Name</label>
                <input
                  id="student-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="field"
                  required
                />
              </div>

              <div>
                <label htmlFor="student-email" className="field-label">Email</label>
                <input
                  id="student-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="field"
                  required
                />
              </div>

              <div>
                <label htmlFor="student-password" className="field-label">Password</label>
                <input
                  id="student-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="field"
                  required
                  minLength={8}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Minimum 8 characters
                </p>
              </div>

              <div>
                <label htmlFor="student-phone" className="field-label">Phone (optional)</label>
                <input
                  id="student-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="field"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending ? 'Creating…' : 'Create student'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={dismissCreate}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}


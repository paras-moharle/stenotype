'use client';

import { Modal } from '@/components/ui/modal';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { formatISTDateTime } from '@/lib/datetime';
import { Plus, X } from 'lucide-react';
import { useAdminList, type AdminListSeed } from '@/components/admin/use-admin-list';
import { AdminListPagination } from '@/components/admin/admin-list-pagination';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminRowActions } from '@/components/admin/admin-row-actions';
import { ChoiceMenu } from '@/components/ui/choice-menu';
import { AdminFilterToolbar } from '@/components/admin/admin-filter-toolbar';
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
    updatedAt: string;
    _count: { sessions: number };
  };
  phone: string | null;
  status: string;

  _count: {
    typingAttempts: number;
  };
  createdAt: string;
  lastLogin: string | null;
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

export function AdminStudentsClient({ initial }: { initial: AdminListSeed<Student> }) {
  const list = useAdminList<Student>('students', initial);
  const { query, rows: filtered, loading } = list;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const pending = progress !== null;
  const active = useRef(false);
  const [original, setOriginal] = useState<Student | null>(null);
  const [resetValue, setResetValue] = useState('');
  const [newCredential, setNewCredential] = useState('');
  const [purge, setPurge] = useState<Student | null>(null);
  const [confirmName, setConfirmName] = useState('');

  function startAction(message: string) {
    if (active.current) return false;
    active.current = true;
    setProgress(message);
    setError(null);
    setToast(null);
    return true;
  }

  function finishAction() {
    active.current = false;
    setProgress(null);
  }

  function openStudent(student: Student) {
    setError(null);
    setOriginal(student);
    setEditing(student);
    setResetValue('');
    setNewCredential('');
  }


  function dismissCreate() {
    if (pending) return;
    setShowForm(false);
  }

  function dismissManage() {
    if (pending) return;
    if (original && JSON.stringify(original) !== JSON.stringify(editing) &&
      !window.confirm('Discard unsaved changes?')) return;
    setEditing(null);
    setNewCredential('');
    setResetValue('');
  }

  const [toast, setToast] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startAction('Creating account…')) return;

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

      setToast(`${form.name} created.`);
      setShowForm(false);
      setForm(blankForm);
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create student');
    } finally { finishAction(); }
  };

  const handleAccount = async (student: Student, action: 'access' | 'revoke' | 'update') => {
    if (active.current) return;
    const disabled = student.user.banned || student.status !== 'ACTIVE';
    if (action === 'access' && !disabled && !window.confirm(`Suspend ${student.user.name} and revoke their sessions?`)) return;
    if (action === 'revoke' && !window.confirm(`Sign out ${student.user.name} from all sessions?`)) return;
    const endpoint = action === 'revoke' ? `/api/admin/users/${student.user.id}/revoke-sessions`
      : `/api/admin/students/${student.id}`;
    let payload: object | undefined;
    if (action === 'update' && original) {
      const before = { name: original.user.name, email: original.user.email, phone: original.phone || null, status: original.status };
      const after = { name: student.user.name.trim(), email: student.user.email.trim().toLowerCase(), phone: student.phone?.trim() || null, status: student.status };
      const changed = (Object.keys(after) as (keyof typeof after)[]).filter(key => before[key] !== after[key]);
      if (!changed.length) { setError('No changes to save.'); return; }
      payload = {
        ...Object.fromEntries(changed.map(key => [key, after[key]])),
        expected: Object.fromEntries(changed.map(key => [key, before[key]])),
      };
    } else if (action === 'access') {
      payload = { action: 'set-access', enabled: disabled, expectedCredentialRevision: student.user.updatedAt };
    }
    if (!startAction('Updating account…')) return;
    try {
      const response = await fetch(endpoint, {
        method: action === 'update' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'The account could not be updated.');
      const message = action === 'revoke'
        ? data?.revoked ? 'sessions revoked' : 'has no active session'
        : action === 'access' ? disabled ? 'access restored' : 'suspended; sessions revoked' : 'updated';
      setToast(`${student.user.name}: ${message}.`);
      setEditing(null);
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The account could not be updated.');
    } finally { finishAction(); }
  };

  const handleDelete = async (student: Student) => {
    if (pending || !confirm(`Permanently delete ${student.user.name}? 0 saved results will be removed.`)) return;
    if (!startAction('Deleting account…')) return;
    try {
      const res = await fetch(`/api/admin/students/${student.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Deletion could not be confirmed. Review the refreshed list before trying again.');
        if (res.status === 404 || res.status >= 500) list.reload();
        return;
      }

      setToast(`${student.user.name} deleted.`);
      list.removeConfirmed(row => row.id === student.id);
    } catch {
      setError('Deletion was not confirmed. Review the refreshed list before trying again.');
      list.reload();
    } finally { finishAction(); }
  };

  const resetPassword = async (student: Student) => {
    if (active.current || !window.confirm(`Reset the password for ${student.user.email} and revoke their sessions?`)) return;
    if (resetValue && (resetValue.length < 8 || resetValue.length > 128)) {
      setError('Use 8–128 characters or leave the password blank to generate one.');
      return;
    }
    if (!startAction('Resetting password…')) return;
    try {
      const response = await fetch(`/api/admin/students/${student.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', password: resetValue || undefined, expectedCredentialRevision: student.user.updatedAt }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.password) throw new Error(data?.error ?? 'Password reset could not be confirmed.');
      setNewCredential(data.password);
      setResetValue('');
      setToast(`${student.user.name}: password reset; sessions revoked.`);
      list.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not reset the password.');
    } finally { finishAction(); }
  };

  const purgeStudent = async () => {
    if (!purge || confirmName !== purge.user.name || !startAction('Deleting account and results…')) return;
    try {
      const response = await fetch(`/api/admin/students/${purge.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'purge', confirmName, expectedResults: purge._count.typingAttempts }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? 'Deletion could not be confirmed.');
      setToast(`${purge.user.name} and ${data.deletedResults} saved results deleted.`);
      setPurge(null);
      setEditing(null);
      setNewCredential('');
      list.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not delete the student.');
    } finally { finishAction(); }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (s: Student) => (
        <div>
          <div className="font-medium [overflow-wrap:anywhere]">{s.user.name}</div>
          <div className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{s.user.email}</div>
          <div className="mt-1 text-xs text-muted-foreground sm:hidden">
            {s.user.banned || s.status !== 'ACTIVE' ? 'Access disabled' : 'Active'}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      className: 'hidden sm:table-cell',
      render: (s: Student) => s.phone ?? '—',
    },
    {
      key: 'attempts',
      header: 'Saved results',
      className: 'hidden sm:table-cell',
      render: (s: Student) => (
        <span className="font-mono tabular-nums">{s._count.typingAttempts}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      className: 'hidden sm:table-cell',
      render: (s: Student) => {
        if (s.user.banned || s.status !== 'ACTIVE') {
          return <span className="badge badge-danger">Access disabled</span>;
        }
        const label = 'Active';
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
          <Button variant="outline" disabled={pending} onClick={() => openStudent(s)}>Manage</Button>
          <AdminRowActions label={`More actions for ${s.user.name}`} disabled={pending}>
            <a href={`/admin/results?student=${encodeURIComponent(s.id)}`}>View results</a>
            <a href={`/admin/login-history?student=${encodeURIComponent(s.user.id)}`}>View login history</a>
            {s._count.typingAttempts === 0 && <>
              <hr />
              <button type="button" className="text-destructive" onClick={() => handleDelete(s)}>Delete unused account</button>
            </>}
          </AdminRowActions>
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

      <AdminFilterToolbar>
        <AdminSearch value={query} onChange={list.changeQuery} placeholder="Search students..." />
        <ChoiceMenu label="Access status" value={list.status || 'all'}
          options={[{ value: 'all', label: 'All students' }, { value: 'eligible', label: 'Can sign in' }, { value: 'disabled', label: 'Access disabled' }]}
          onChange={value => list.changeStatus(value === 'all' ? '' : value)}
        />
      </AdminFilterToolbar>

      {error && !showForm && !editing && !purge && (
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

      {progress && !showForm && !editing && !purge && <p role="status">{progress}</p>}
      {list.refreshing && <p role="status" className="text-sm text-muted-foreground">Refreshing students…</p>}
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
          title={query || list.status ? 'No matching students' : 'No students yet'}
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

      {editing && !purge && (
        <Modal title="Manage student" onClose={dismissManage}>
          <form className="space-y-5 p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); void handleAccount(editing, 'update'); }}>
            <div><h2 className="text-h2 font-semibold">Manage student</h2><p className="text-sm text-muted-foreground">{editing.user.email}</p></div>
            <label className="block"><span className="field-label">Name</span><input className="field" required value={editing.user.name}
              onChange={(event) => setEditing({ ...editing, user: { ...editing.user, name: event.target.value } })} /></label>
            <label className="block"><span className="field-label">Email</span><input type="email" className="field" maxLength={254} required value={editing.user.email}
              onChange={(event) => setEditing({ ...editing, user: { ...editing.user, email: event.target.value } })} /></label>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-muted-foreground">Created</dt><dd>{formatISTDateTime(editing.createdAt)}</dd></div>
              <div><dt className="text-muted-foreground">Last recorded sign-in</dt><dd>{editing.lastLogin ? formatISTDateTime(editing.lastLogin) : 'None recorded'}</dd></div>
              <div><dt className="text-muted-foreground">Current session</dt><dd>{editing.user._count.sessions && !editing.user.banned && editing.status === 'ACTIVE' ? 'Active session' : 'None'}</dd></div>
              <div><dt className="text-muted-foreground">Saved results</dt><dd>{editing._count.typingAttempts}</dd></div>
            </dl>
            <label className="block"><span className="field-label">Phone</span><input className="field" type="tel" value={editing.phone ?? ''}
              onChange={(event) => setEditing({ ...editing, phone: event.target.value })} /></label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>{progress ?? 'Save changes'}</Button>
              <Button type="button" variant="outline" disabled={pending} onClick={dismissManage}>Cancel</Button>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" disabled={pending} onClick={() => handleAccount(editing, 'revoke')}>Revoke session</Button>
              <Button type="button" variant={editing.user.banned || editing.status !== 'ACTIVE' ? 'outline' : 'destructive'} disabled={pending} onClick={() => handleAccount(original ?? editing, 'access')}>
                {editing.user.banned || editing.status !== 'ACTIVE' ? 'Restore access' : 'Suspend access'}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href={`/admin/results?student=${encodeURIComponent(editing.id)}`}>View results</Link></Button>
              <Button asChild variant="outline"><Link href={`/admin/login-history?student=${encodeURIComponent(editing.user.id)}`}>Login history</Link></Button>
              <Button type="button" disabled={pending} variant="destructive" onClick={() => {
                setConfirmName(''); setError(null); setNewCredential(''); setPurge(original ?? editing);
              }}>Delete account and results</Button>
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <label className="block"><span className="field-label">Replacement password (optional)</span>
                <input type="password" className="field" autoComplete="new-password" value={resetValue} maxLength={128}
                  onChange={event => setResetValue(event.target.value)} placeholder="Leave blank to generate" />
              </label>
              <Button type="button" variant="outline" disabled={pending || Boolean(newCredential)} onClick={() => resetPassword(original ?? editing)}>Reset password</Button>
              {newCredential && <div className="space-y-2 rounded-xl border border-border p-3" role="status">
                <p className="text-sm">Copy this password for private delivery. It will close with this dialog.</p>
                <input className="field font-mono" readOnly value={newCredential} aria-label="Replacement password" onFocus={event => event.target.select()} />
                <Button type="button" variant="outline" onClick={async () => {
                  try { await navigator.clipboard.writeText(newCredential); setToast('Replacement password copied.'); }
                  catch { setError('Clipboard unavailable. Select the password to copy it manually.'); }
                }}>Copy password</Button>
              </div>}
            </div>
          </form>
        </Modal>
      )}

      {purge && <Modal title="Delete student and results" onClose={() => { if (!pending) setPurge(null); }}>
        <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Delete {purge.user.name} and their results</h2>
          <p className="text-sm text-muted-foreground">This permanently deletes the account and {purge._count.typingAttempts} saved results, and revokes sessions.</p>
          <label className="block"><span className="field-label">Type {purge.user.name} to confirm</span>
            <input className="field" value={confirmName} onChange={event => setConfirmName(event.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" disabled={pending || confirmName !== purge.user.name} onClick={purgeStudent}>
              {pending ? 'Deleting…' : 'Delete account and results'}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setPurge(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>}

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


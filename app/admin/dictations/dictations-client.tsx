'use client';

import { Modal } from '@/components/ui/modal';

import { useRef, useState } from 'react';
import { Plus, X, Pencil } from 'lucide-react';
import { useAdminList, type AdminListSeed } from '@/components/admin/use-admin-list';
import { AdminListPagination } from '@/components/admin/admin-list-pagination';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminRowActions } from '@/components/admin/admin-row-actions';
import { ChoiceMenu } from '@/components/ui/choice-menu';
import { AdminFilterToolbar } from '@/components/admin/admin-filter-toolbar';
import { AdminSearch } from '@/components/admin/admin-search';
import { AdminEmptyState } from '@/components/admin/admin-empty-state';
import { youtubeWatchUrl } from '@/lib/youtube';
import { Button } from '@/components/ui/button';

const categoryOptions = [
  { value: 'LEGAL', label: 'Legal' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'GENERAL', label: 'General' },
];

type Dictation = {
  _count: { typingAttempts: number };
  id: string;
  updatedAt: string;
  title: string;
  category: string;
  status: string;
  youtubeId: string | null;
  createdAt: string;
};

type FormState = {
  title: string;
  category: string;
  referenceTranscript: string;
  youtubeId: string;
  status: string;
};

const blankForm: FormState = {
  title: '',
  category: 'GENERAL',
  referenceTranscript: '',
  youtubeId: '',
  status: 'DRAFT',
};

export function AdminDictationsClient({ initial }: { initial: AdminListSeed<Dictation> }) {
  const list = useAdminList<Dictation>('dictations', initial);
  const { query, rows: filtered, loading } = list;
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [error, setError] = useState<string | null>(null);
  const [originalForm, setOriginalForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);
  const active = useRef(false);
  const creationKey = useRef<string | null>(null);
  const [purge, setPurge] = useState<{ id: string; title: string; _count: { typingAttempts: number } } | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');

  function beginMutation() {
    if (active.current) return false;
    active.current = true;
    setSaving(true);
    setError(null);
    setToast(null);
    return true;
  }
  function finishMutation() {
    active.current = false;
    setSaving(false);
  }
  const [deleting, setDeleting] = useState<string | null>(null);
  function dismissEditor() {
    if (saving) return;
    if (JSON.stringify(originalForm) !== JSON.stringify(form) && !window.confirm('Discard unsaved changes?')) return;
    setShowForm(false);
    setEditingId(null);
  }
  const [toast, setToast] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beginMutation()) return;

    try {
      const url = editingId
        ? `/api/admin/dictations/${editingId}`
        : '/api/admin/dictations';
      const method = editingId ? 'PUT' : 'POST';
      if (!editingId && !creationKey.current) creationKey.current = Array.from(crypto.getRandomValues(new Uint8Array(18)), byte => byte.toString(16).padStart(2, '0')).join('');

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(!editingId && creationKey.current ? { 'Idempotency-Key': creationKey.current } : {}),
        },
        body: JSON.stringify({
          ...form,
          youtubeId: form.youtubeId || null,
          ...(editingId && editingVersion ? { expectedUpdatedAt: editingVersion } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save dictation');
      }

      setToast(`${form.title} ${editingId ? 'updated' : 'created'}.`);
      creationKey.current = null;
      setShowForm(false);
      setEditingId(null);
      setForm(blankForm);
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dictation');
    } finally { finishMutation(); }
  };

  const [loadingEdit, setLoadingEdit] = useState(false);
  const handleEdit = async (dictation: Dictation) => {
    if (loadingEdit) return;
    setLoadingEdit(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/dictations/${dictation.id}`);
      if (!response.ok) throw new Error();
      const { dictation: details } = await response.json();
      setEditingId(details.id);
      setEditingVersion(details.updatedAt);
      const nextForm = {
        title: details.title,
        category: details.category,
        referenceTranscript: details.referenceTranscript,
        youtubeId: details.youtubeId ?? '',
        status: details.status,
      };
      setOriginalForm(nextForm);
      setForm(nextForm);
      setShowForm(true);
    } catch {
      setError('Could not load this dictation for editing.');
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleDelete = async (dictation: Dictation) => {
    if (deleting || saving || !confirm(`Permanently delete “${dictation.title}”? 0 saved results will be removed.`)) return;

    if (!beginMutation()) return;
    setDeleting(dictation.id);
    try {
      const res = await fetch(`/api/admin/dictations/${dictation.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to delete dictation');
      }

      setToast(`${dictation.title} deleted.`);
      list.reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete dictation'
      );
    } finally { setDeleting(null); finishMutation(); }
  };

  const changePublication = async (item: Dictation, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    const action = status === 'DRAFT' ? 'Unpublish' : status === 'ARCHIVED' ? 'Archive' : 'Publish';
    if (active.current || !window.confirm(`${action} “${item.title}”? Saved results will be retained.`)) return;
    if (!beginMutation()) return;
    try {
      const response = await fetch(`/api/admin/dictations/${item.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, expectedUpdatedAt: item.updatedAt }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Could not update publication.');
      setToast(`${item.title} ${status === 'DRAFT' ? 'unpublished' : status === 'ARCHIVED' ? 'archived' : 'published'}.`);
      list.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update publication.');
    } finally { finishMutation(); }
  };

  const openPurge = async (item: Dictation) => {
    if (!beginMutation()) return;
    try {
      const response = await fetch(`/api/admin/dictations/${item.id}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not read the current result count.');
      setPurge((await response.json()).dictation);
      setConfirmTitle('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not prepare deletion.');
    } finally { finishMutation(); }
  };

  const purgeDictation = async () => {
    if (!purge || confirmTitle !== purge.title || !beginMutation()) return;
    try {
      const response = await fetch(`/api/admin/dictations/${purge.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmTitle, expectedResults: purge._count.typingAttempts }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? 'Deletion could not be confirmed.');
      setToast(`${purge.title} and ${data.deletedResults} saved results deleted.`);
      setPurge(null);
      list.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not delete the dictation.');
    } finally { finishMutation(); }
  };

  const columns = [
    {
      key: 'title',
      header: 'Title',
      className: 'whitespace-normal',
      render: (d: Dictation) => (
        <div>
          <div className="font-medium [overflow-wrap:anywhere]">{d.title}</div>
          <div className="mt-1 text-xs capitalize text-muted-foreground sm:hidden">
            {d.category.toLowerCase()} · {d.status.toLowerCase()}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      className: 'hidden sm:table-cell',
      render: (d: Dictation) => d.category,
    },
    {
      key: 'status',
      header: 'Status',
      className: 'hidden sm:table-cell',
      render: (d: Dictation) => (
        <span
          className={
            d.status === 'PUBLISHED'
              ? 'text-success font-medium'
              : 'text-warning font-medium'
          }
        >
          {d.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (d: Dictation) => {
        const youtube = youtubeWatchUrl(d.youtubeId);
        return (
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="outline"
            disabled={loadingEdit}
            onClick={() => handleEdit(d)}
            aria-label={`Edit ${d.title}`}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <AdminRowActions label={`More actions for ${d.title}`} disabled={Boolean(deleting) || saving || loadingEdit}>
            {youtube && <a href={youtube} target="_blank" rel="noopener noreferrer">Open on YouTube</a>}
            {d.status === 'PUBLISHED'
              ? <button type="button" onClick={() => changePublication(d, 'DRAFT')}>Unpublish</button>
              : <button type="button" onClick={() => changePublication(d, 'PUBLISHED')}>{d.status === 'ARCHIVED' ? 'Republish' : 'Publish'}</button>}
            {d.status !== 'ARCHIVED' && <button type="button" onClick={() => changePublication(d, 'ARCHIVED')}>Archive</button>}
            <hr />
            {d._count.typingAttempts === 0
              ? <button type="button" className="text-destructive" onClick={() => handleDelete(d)}>Delete unused dictation</button>
              : <button type="button" className="text-destructive" onClick={() => openPurge(d)}>Delete dictation and results</button>}
          </AdminRowActions>
        </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Dictations"
        description="Upload and manage dictation exercises"
        action={
          <Button
            disabled={loadingEdit || saving}
            onClick={() => {
              creationKey.current = null;
              setError(null);
              setEditingId(null);
              setOriginalForm(blankForm);
              setForm(blankForm);
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Upload Dictation
          </Button>
        }
      />

      <AdminFilterToolbar>
        <AdminSearch value={query} onChange={list.changeQuery} placeholder="Search dictations..." />
        <ChoiceMenu label="Publication status" value={list.status || 'all'}
          options={[{ value: 'all', label: 'All statuses' }, { value: 'PUBLISHED', label: 'Published' }, { value: 'DRAFT', label: 'Draft' }, { value: 'ARCHIVED', label: 'Archived' }]}
          onChange={value => list.changeStatus(value === 'all' ? '' : value)}
        />
        <ChoiceMenu label="Category" value={list.category || 'all'}
          options={[{ value: 'all', label: 'All categories' }, ...categoryOptions]}
          onChange={value => list.changeCategory(value === 'all' ? '' : value)}
        />
      </AdminFilterToolbar>

      {error && !showForm && !purge && (
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

      {list.refreshing && <p role="status" className="text-sm text-muted-foreground">Refreshing dictations…</p>}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading dictations...
        </div>
      ) : list.error ? (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{list.error}</p>
          <Button variant="outline" size="sm" onClick={list.reload}>Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title={query || list.status || list.category ? 'No matching dictations' : 'No dictations yet'}
          description={
            query
              ? 'Try a different title or category.'
              : 'Add a dictation with its transcript to start practising.'
          }
          action={
            query ? undefined : (
              <Button
                onClick={() => {
                  setEditingId(null);
                  setOriginalForm(blankForm);
              setForm(blankForm);
                  setShowForm(true);
                }}
              >
                Upload dictation
              </Button>
            )
          }
        />
      ) : (
        <AdminTable
          columns={columns}
          rows={filtered}
          rowKey={(d) => d.id}
        />
      )}

      <AdminListPagination page={list.page} more={list.more} onPage={list.setPage} />

      {purge && <Modal title="Delete dictation and results" onClose={() => { if (!saving) setPurge(null); }}>
        <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Delete {purge.title} and its results</h2>
          <p className="text-sm text-muted-foreground">This permanently removes the dictation and {purge._count.typingAttempts} saved results. Students cannot submit this dictation after deletion.</p>
          <label className="block"><span className="field-label">Type the full title to confirm</span>
            <input className="field" value={confirmTitle} onChange={event => setConfirmTitle(event.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" disabled={saving || confirmTitle !== purge.title} onClick={purgeDictation}>{saving ? 'Deleting…' : 'Delete dictation and results'}</Button>
            <Button variant="outline" disabled={saving} onClick={() => setPurge(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>}

      {showForm && (
        <Modal title={editingId ? "Edit dictation" : "New dictation"} onClose={dismissEditor} className="max-w-2xl">
          <div className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Edit Dictation' : 'Upload Dictation'}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                disabled={saving}
                onClick={dismissEditor}
                aria-label="Close editor"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div>
                <label htmlFor="dict-title" className="field-label">Title</label>
                <input
                  id="dict-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="field"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="field-label">Category</span>
                  <ChoiceMenu label="Category" value={form.category} options={categoryOptions}
                    onChange={category => setForm({ ...form, category })} disabled={saving} />

                </div>

                <div>
                  <span className="field-label">Publication status</span>
                  <ChoiceMenu label="Publication status" value={form.status} disabled={saving}
                    options={[
                      { value: 'DRAFT', label: 'Draft' }, { value: 'PUBLISHED', label: 'Published' },
                      ...(editingId ? [{ value: 'ARCHIVED', label: 'Archived' }] : []),
                    ]}
                    onChange={status => setForm({ ...form, status })} />

                </div>
              </div>

              <div>
                <label htmlFor="dict-youtube" className="field-label">
                  YouTube link or video ID (optional)
                </label>
                <input
                  id="dict-youtube"
                  type="text"
                  value={form.youtubeId}
                  onChange={(e) => setForm({ ...form, youtubeId: e.target.value })}
                  className="field"
                  placeholder="e.g. dQw4w9WgXcQ"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Paste a YouTube watch, Shorts, live or share link, or the video ID.
                </p>
              </div>

              <div>
                <label htmlFor="dict-transcript" className="field-label">Transcript</label>
                <textarea
                  id="dict-transcript"
                  value={form.referenceTranscript}
                  onChange={(e) =>
                    setForm({ ...form, referenceTranscript: e.target.value })
                  }
                  className="field h-auto min-h-48 resize-y py-3 font-mono"
                  required
                  rows={9}
                  maxLength={50_000}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {form.referenceTranscript.length} / 50,000 draft characters. Published transcripts are available for study in the library and hidden during blind typing.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Update dictation' : 'Create dictation'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={dismissEditor}
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


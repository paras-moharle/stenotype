'use client';

import { Modal } from '@/components/ui/modal';

import { useState } from 'react';
import { Plus, X, Trash2, Pencil } from 'lucide-react';
import { useAdminList } from '@/components/admin/use-admin-list';
import { AdminListPagination } from '@/components/admin/admin-list-pagination';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminSearch } from '@/components/admin/admin-search';
import { AdminEmptyState } from '@/components/admin/admin-empty-state';
import { Button } from '@/components/ui/button';

type Dictation = {
  id: string;
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

export default function AdminDictationsPage() {
  const list = useAdminList<Dictation>('dictations');
  const { query, rows: filtered, loading } = list;
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [error, setError] = useState<string | null>(null);
  const [originalForm, setOriginalForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);
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
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const url = editingId
        ? `/api/admin/dictations/${editingId}`
        : '/api/admin/dictations';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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

      setToast(editingId ? 'Dictation updated' : 'Dictation created');
      setShowForm(false);
      setEditingId(null);
      setForm(blankForm);
      list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dictation');
    } finally { setSaving(false); }
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
    if (deleting || saving || !confirm(`Delete "${dictation.title}"?`)) return;

    setDeleting(dictation.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/dictations/${dictation.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Failed to delete dictation');
      }

      setToast('Dictation deleted');
      list.reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete dictation'
      );
    } finally { setDeleting(null); }
  };

  const columns = [
    {
      key: 'title',
      header: 'Title',
      render: (d: Dictation) => (
        <div className="font-medium">{d.title}</div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (d: Dictation) => d.category,
    },
    {
      key: 'status',
      header: 'Status',
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
      key: 'youtube',
      header: 'YouTube',
      render: (d: Dictation) =>
        d.youtubeId ? (
          <a
            href={`https://youtube.com/watch?v=${d.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            Watch
          </a>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (d: Dictation) => (
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
          <Button
            size="icon"
            variant="outline"
            disabled={Boolean(deleting) || saving}
            aria-label={`Delete ${d.title}`}
            onClick={() => handleDelete(d)}
            title="Delete"
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
        title="Dictations"
        description="Upload and manage dictation exercises"
        action={
          <Button
            disabled={loadingEdit || saving}
            onClick={() => {
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

      <AdminSearch
        value={query}
        onChange={list.changeQuery}
        placeholder="Search dictations..."
      />

      {error && !showForm && (
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
          title={query ? 'No matching dictations' : 'No dictations yet'}
          description={
            query
              ? 'Try a different title or transcript.'
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
                  <label htmlFor="dict-category" className="field-label">Category</label>
                  <select
                    id="dict-category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="field"
                  >
                    <option value="LEGAL">Legal</option>
                    <option value="PROFESSIONAL">Professional</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="dict-status" className="field-label">Status</label>
                  <select
                    id="dict-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="field"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    {editingId && <option value="ARCHIVED">Archived</option>}
                  </select>
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


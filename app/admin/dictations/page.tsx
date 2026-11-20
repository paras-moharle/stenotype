'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2, Pencil } from 'lucide-react';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminSearch } from '@/components/admin/admin-search';
import { Button } from '@/components/ui/button';

type Dictation = {
  id: string;
  title: string;
  category: string;
  status: string;
  referenceTranscript: string;
  youtubeId: string | null;
  durationSeconds: number | null;
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
  const [query, setQuery] = useState('');
  const [dictations, setDictations] = useState<Dictation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchDictations = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dictations');
      if (res.ok) {
        const data = await res.json();
        setDictations(data.dictations);
      }
    } catch {
      setError('Failed to load dictations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDictations();
  }, [fetchDictations]);

  const filtered = dictations.filter(
    (d) =>
      d.title.toLowerCase().includes(query.toLowerCase()) ||
      d.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      fetchDictations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dictation');
    }
  };

  const handleEdit = (dictation: Dictation) => {
    setEditingId(dictation.id);
    setForm({
      title: dictation.title,
      category: dictation.category,
      referenceTranscript: dictation.referenceTranscript,
      youtubeId: dictation.youtubeId ?? '',
      status: dictation.status,
    });
    setShowForm(true);
  };

  const handleDelete = async (dictation: Dictation) => {
    if (!confirm(`Delete "${dictation.title}"?`)) return;

    try {
      const res = await fetch(`/api/admin/dictations/${dictation.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      setToast('Dictation deleted');
      fetchDictations();
    } catch {
      setError('Failed to delete dictation');
    }
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
              ? 'text-green-500 font-medium'
              : 'text-yellow-500 font-medium'
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
            className="text-blue-500 hover:underline"
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
            size="sm"
            variant="outline"
            onClick={() => handleEdit(d)}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
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
            onClick={() => {
              setEditingId(null);
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
        onChange={setQuery}
        placeholder="Search dictations..."
      />

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-500">
          {error}
        </div>
      )}

      {toast && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-500">
          {toast}
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-green-500 hover:text-green-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading dictations...
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={filtered}
          rowKey={(d) => d.id}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-background p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Edit Dictation' : 'Upload Dictation'}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="dict-title" className="mb-1 block text-sm font-medium">Title</label>
                <input
                  id="dict-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dict-category" className="mb-1 block text-sm font-medium">Category</label>
                  <select
                    id="dict-category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    <option value="LEGAL">Legal</option>
                    <option value="PROFESSIONAL">Professional</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="dict-status" className="mb-1 block text-sm font-medium">Status</label>
                  <select
                    id="dict-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="dict-youtube" className="mb-1 block text-sm font-medium">
                  YouTube Video ID (optional)
                </label>
                <input
                  id="dict-youtube"
                  type="text"
                  value={form.youtubeId}
                  onChange={(e) => setForm({ ...form, youtubeId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  placeholder="e.g. dQw4w9WgXcQ"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Just the video ID from the YouTube URL
                </p>
              </div>

              <div>
                <label htmlFor="dict-transcript" className="mb-1 block text-sm font-medium">Transcript</label>
                <textarea
                  id="dict-transcript"
                  value={form.referenceTranscript}
                  onChange={(e) =>
                    setForm({ ...form, referenceTranscript: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 min-h-40"
                  required
                  rows={8}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The text students will type against. This is never shown to students before they complete the dictation.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1">
                  {editingId ? 'Update Dictation' : 'Create Dictation'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


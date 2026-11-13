'use client';

import { useState, useRef } from 'react';
import { Plus, Upload, X, FileAudio, Save } from 'lucide-react';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminEmptyState } from '@/components/admin/admin-empty-state';
import { Button } from '@/components/ui/button';
import { dictations, type Dictation } from '@/lib/admin-data';
import { dictationSchema } from '@/lib/schemas';

const CATEGORIES = ['General', 'Professional', 'Legal'] as const;
const ASSIGNMENTS = ['All', 'Batch A', 'Batch B', 'Batch C', 'Batch D', 'Individual'] as const;
const STATUSES = ['Draft', 'Published', 'Archived'] as const;

type FormState = {
  title: string;
  category: (typeof CATEGORIES)[number];
  status: (typeof STATUSES)[number];
  assignedTo: (typeof ASSIGNMENTS)[number];
  availableFrom: string;
  availableUntil: string;
  referenceTranscript: string;
};

const blankForm: FormState = {
  title: '',
  category: 'General',
  status: 'Draft',
  assignedTo: 'All',
  availableFrom: '',
  availableUntil: '',
  referenceTranscript: '',
};

export default function AdminDictationsPage() {
  const [showForm, setShowForm] = useState(false);
  const [audioFile, setAudioFile] = useState<{ name: string; size: string } | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [rows, setRows] = useState<Dictation[]>(dictations);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleFileSelect = (file: File) => {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    setAudioFile({ name: file.name, size: `${sizeMB} MB` });
  };

  const submit = (status: 'Draft' | 'Published') => {
    const result = dictationSchema.safeParse({ ...form, status });
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {};
      for (const issue of result.error.issues) {
        const k = issue.path[0] as keyof FormState;
        fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setRows((prev) => [
      {
        id: `d${Date.now()}`,
        title: form.title,
        category: form.category,
        duration: '—',
        status,
        assignedTo: form.assignedTo,
        availableFrom: form.availableFrom || '—',
        availableUntil: form.availableUntil || '—',
      },
      ...prev,
    ]);
    setForm(blankForm);
    setAudioFile(null);
    setShowForm(false);
    setToast(
      status === 'Published'
        ? 'Dictation published (mock — not saved to a database yet).'
        : 'Draft saved (mock).'
    );
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Dictations"
        description="Manage dictation audio and reference transcripts."
        action={
          <Button onClick={() => setShowForm((v) => !v)} className="gap-1.5">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'New Dictation'}
          </Button>
        }
      />

      {toast && (
        <div className="rounded-md border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
          {toast}
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="mb-6 text-base font-semibold text-foreground">
            New Dictation
          </h2>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <Field label="Title" error={errors.title}>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="e.g. Court Proceedings — Verdict"
                  className={inputClass(!!errors.title)}
                />
              </Field>

              <Field label="Category" error={errors.category}>
                <select
                  value={form.category}
                  onChange={(e) =>
                    update('category', e.target.value as FormState['category'])
                  }
                  className={inputClass(!!errors.category)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Assignment" error={errors.assignedTo}>
                <select
                  value={form.assignedTo}
                  onChange={(e) =>
                    update(
                      'assignedTo',
                      e.target.value as FormState['assignedTo']
                    )
                  }
                  className={inputClass(!!errors.assignedTo)}
                >
                  {ASSIGNMENTS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Available From" error={errors.availableFrom}>
                  <input
                    type="date"
                    value={form.availableFrom}
                    onChange={(e) => update('availableFrom', e.target.value)}
                    className={inputClass(!!errors.availableFrom)}
                  />
                </Field>
                <Field label="Available Until" error={errors.availableUntil}>
                  <input
                    type="date"
                    value={form.availableUntil}
                    onChange={(e) => update('availableUntil', e.target.value)}
                    className={inputClass(!!errors.availableUntil)}
                  />
                </Field>
              </div>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) =>
                    update('status', e.target.value as FormState['status'])
                  }
                  className={inputClass(false)}
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="space-y-5">
              <Field label="Audio">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
                {audioFile ? (
                  <div className="flex items-center justify-between rounded-md border border-border bg-background p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-brand">
                        <FileAudio className="h-4 w-4" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {audioFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {audioFile.size} · Ready to upload to R2
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAudioFile(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label="Remove audio"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center rounded-md border border-dashed border-border bg-background px-6 py-8 text-center transition-colors hover:border-brand/40 hover:bg-accent/30"
                  >
                    <Upload
                      className="mb-2 h-5 w-5 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <p className="text-sm font-medium text-foreground">
                      Choose audio file
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      MP3, WAV, or M4A — uploads when backend is connected
                    </p>
                  </button>
                )}
              </Field>

              <Field label="Reference Transcript" error={errors.referenceTranscript}>
                <textarea
                  rows={8}
                  value={form.referenceTranscript}
                  onChange={(e) => update('referenceTranscript', e.target.value)}
                  placeholder="Type the reference transcript here..."
                  className={`${inputClass(!!errors.referenceTranscript)} font-mono`}
                />
              </Field>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5">
            <Button variant="outline" onClick={() => submit('Draft')}>
              Save Draft
            </Button>
            <Button onClick={() => submit('Published')}>Publish</Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <AdminEmptyState
          title="No dictations yet"
          description="Create your first dictation to get started."
          action={
            <Button onClick={() => setShowForm(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Dictation
            </Button>
          }
        />
      ) : (
        <AdminTable<Dictation>
          rows={rows}
          rowKey={(d) => d.id}
          columns={[
            {
              key: 'title',
              header: 'Title',
              render: (d) => (
                <div>
                  <p className="font-medium text-foreground">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.availableFrom === '—'
                      ? 'Unscheduled'
                      : `${d.availableFrom} → ${d.availableUntil}`}
                  </p>
                </div>
              ),
            },
            {
              key: 'category',
              header: 'Category',
              render: (d) => (
                <span className="text-muted-foreground">{d.category}</span>
              ),
            },
            {
              key: 'duration',
              header: 'Duration',
              render: (d) => (
                <span className="font-mono text-foreground">{d.duration}</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (d) => <AdminStatusBadge status={d.status} />,
            },
            {
              key: 'assignedTo',
              header: 'Assigned To',
              render: (d) => (
                <span className="text-muted-foreground">{d.assignedTo}</span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

/* ─── Small shared form primitives ─────────────────────── */

const inputClass = (hasError: boolean) =>
  `h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
    hasError
      ? 'border-destructive/50 focus:border-destructive/50 focus:ring-destructive/20'
      : 'border-border focus:border-brand/40 focus:ring-brand/20'
  }`;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  Plus,
  X,
  Save,
  Headphones,
  BookOpen,
  Type,
  Edit3,
  Check,
  Sparkles,
  Trash2,
  AlertCircle,
  FileAudio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
import {
  typingPassages as initialPassages,
  type TypingPassage,
} from '@/lib/admin-data';
import { typingPassageSchema } from '@/lib/schemas';
import { generatePassage } from '@/lib/passage-generator';
import { mockDictations } from '@/lib/dictation-transcripts';

type Tab = 'dictations' | 'passages' | 'site';

type PassageForm = {
  title: string;
  category: 'General' | 'Professional' | 'Legal';
  text: string;
  status: 'Draft' | 'Published' | 'Archived';
};

const blankForm: PassageForm = {
  title: '',
  category: 'General',
  text: '',
  status: 'Draft',
};

export default function AdminContentPage() {
  const [tab, setTab] = useState<Tab>('dictations');

  /* ─── Dictations (audio + transcript) ──────────────────── */
  const [dictations, setDictations] = useState(mockDictations);
  const [editingTranscript, setEditingTranscript] = useState<string | null>(
    null
  );
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: 'dictation' | 'passage' | 'audio';
    id: string;
    label: string;
  } | null>(null);

  /* ─── Typing passages ───────────────────────────────────── */
  const [passages, setPassages] = useState<TypingPassage[]>(initialPassages);
  const [showPassageForm, setShowPassageForm] = useState(false);
  const [form, setForm] = useState<PassageForm>(blankForm);
  const [errors, setErrors] = useState<Partial<Record<keyof PassageForm, string>>>({});

  /* ─── Site copy (used by public pages) ──────────────────── */
  const [site, setSite] = useState({
    announcement:
      'New dictation schedule for September is now available. Check the Dictations page for details.',
    heroHeadline: 'Dictation. Transcription. Typing.',
    heroSubheading:
      'A focused digital practice companion for stenography students. Build speed, improve accuracy, and track your progress between classes.',
    classDescription:
      'Attend your regular stenography classes, then use StenoType to practice dictation, transcription, and typing between sessions.',
  });
  const [toast, setToast] = useState<string | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  /* ─── Passage form helpers ──────────────────────────────── */
  const update = <K extends keyof PassageForm>(k: K, v: PassageForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const autoGenerate = () => {
    const generated = generatePassage({ category: form.category, targetWords: 60 });
    update('text', generated);
    if (!form.title) update('title', `Auto-generated ${form.category} passage`);
  };

  const submitPassage = (e: React.FormEvent) => {
    e.preventDefault();
    const result = typingPassageSchema.safeParse(form);
    if (!result.success) {
      const fe: Partial<Record<keyof PassageForm, string>> = {};
      for (const issue of result.error.issues) {
        fe[issue.path[0] as keyof PassageForm] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    setPassages((prev) => [
      {
        id: `tp${Date.now()}`,
        title: form.title,
        category: form.category,
        length: form.text.trim().split(/\s+/).filter(Boolean).length,
        status: form.status,
      },
      ...prev,
    ]);
    setForm(blankForm);
    setShowPassageForm(false);
    flash('Passage saved (mock).');
  };

  /* ─── Transcript edit helpers ────────────────────────────── */
  const startEditTranscript = (id: string, current: string) => {
    setEditingTranscript(id);
    setTranscriptDraft(current);
  };

  const saveTranscript = (id: string) => {
    setDictations((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, referenceTranscript: transcriptDraft } : d
      )
    );
    setEditingTranscript(null);
    flash('Transcript updated (mock).');
  };

  /* ─── Delete handlers ───────────────────────────────────── */
  const deleteDictation = (id: string) => {
    setDictations((prev) => prev.filter((d) => d.id !== id));
    setConfirmDelete(null);
    if (editingTranscript === id) setEditingTranscript(null);
    flash('Dictation deleted (mock).');
  };

  const deletePassage = (id: string) => {
    setPassages((prev) => prev.filter((p) => p.id !== id));
    setConfirmDelete(null);
    flash('Passage deleted (mock).');
  };

  const deleteAudio = (id: string) => {
    // In the future this will call the R2 delete API. For now we
    // just clear the audio key on the dictation record.
    setDictations((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, referenceTranscript: d.referenceTranscript } : d
      )
    );
    setConfirmDelete(null);
    flash('Audio cleared (mock — R2 deletion will replace this).');
  };

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Content library"
        description="Dictations, transcripts, typing passages, and the copy that appears on the public site."
      />

      {toast && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
          <Check className="h-4 w-4" />
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface p-0.5">
        <TabButton
          active={tab === 'dictations'}
          onClick={() => setTab('dictations')}
          icon={Headphones}
          label="Dictations & transcripts"
        />
        <TabButton
          active={tab === 'passages'}
          onClick={() => setTab('passages')}
          icon={Type}
          label="Typing passages"
        />
        <TabButton
          active={tab === 'site'}
          onClick={() => setTab('site')}
          icon={BookOpen}
          label="Site copy"
        />
      </div>

      {/* Tab: Dictations + transcripts */}
      {tab === 'dictations' && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Each dictation has an audio file and a reference transcript.
            Students type the transcript in blind mode. Edit a transcript
            if you spot an error after the fact — the change is reflected
            immediately for students.
          </p>
          {dictations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface/30 px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No dictations yet. Upload one from the Dictations page.
              </p>
            </div>
          ) : (
            <AdminTable<typeof mockDictations[number]>
              rows={dictations}
              rowKey={(d) => d.id}
              columns={[
                {
                  key: 'title',
                  header: 'Dictation',
                  render: (d) => (
                    <div>
                      <p className="font-medium text-foreground">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.category} · {d.duration}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'audio',
                  header: 'Audio',
                  render: (d) => (
                    <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px]">
                      <FileAudio
                        className="h-3 w-3 text-brand"
                        strokeWidth={1.5}
                      />
                      <span className="font-mono text-muted-foreground">
                        {d.id}.mp3
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'transcript',
                  header: 'Transcript',
                  render: (d) =>
                    editingTranscript === d.id ? (
                      <div className="min-w-[320px] space-y-2">
                        <textarea
                          value={transcriptDraft}
                          onChange={(e) => setTranscriptDraft(e.target.value)}
                          rows={3}
                          className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveTranscript(d.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-xs font-medium text-brand-foreground hover:bg-brand/90"
                          >
                            <Check className="h-3 w-3" /> Save
                          </button>
                          <button
                            onClick={() => setEditingTranscript(null)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="max-w-md truncate font-mono text-xs text-muted-foreground">
                        {d.referenceTranscript}
                      </p>
                    ),
                },
                {
                  key: 'actions',
                  header: '',
                  className: 'text-right',
                  render: (d) =>
                    editingTranscript === d.id ? null : (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            startEditTranscript(d.id, d.referenceTranscript)
                          }
                          className="gap-1.5 text-muted-foreground"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setConfirmDelete({
                              kind: 'audio',
                              id: d.id,
                              label: d.title,
                            })
                          }
                          className="gap-1.5 text-muted-foreground"
                          title="Clear audio file"
                        >
                          <FileAudio className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setConfirmDelete({
                              kind: 'dictation',
                              id: d.id,
                              label: d.title,
                            })
                          }
                          className="gap-1.5 text-destructive hover:bg-destructive/10"
                          title="Delete dictation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ),
                },
              ]}
            />
          )}
        </section>
      )}

      {/* Tab: Typing passages */}
      {tab === 'passages' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Short curated passages for free-typing practice (Free mode in
              the student app).
            </p>
            <Button
              onClick={() => setShowPassageForm((v) => !v)}
              className="gap-1.5"
            >
              {showPassageForm ? (
                <X className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {showPassageForm ? 'Cancel' : 'Add passage'}
            </Button>
          </div>

          {showPassageForm && (
            <form
              onSubmit={submitPassage}
              className="rounded-lg border border-border bg-surface p-6"
            >
              <h2 className="mb-5 text-base font-semibold text-foreground">
                New typing passage
              </h2>
              <div className="space-y-5">
                <Field label="Title" error={errors.title}>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => update('title', e.target.value)}
                    placeholder="e.g. Court Opening Statement"
                    className={inputClass(!!errors.title)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Category">
                    <select
                      value={form.category}
                      onChange={(e) =>
                        update('category', e.target.value as PassageForm['category'])
                      }
                      className={inputClass(false)}
                    >
                      <option>General</option>
                      <option>Professional</option>
                      <option>Legal</option>
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      value={form.status}
                      onChange={(e) =>
                        update('status', e.target.value as PassageForm['status'])
                      }
                      className={inputClass(false)}
                    >
                      <option>Draft</option>
                      <option>Published</option>
                      <option>Archived</option>
                    </select>
                  </Field>
                </div>
                <Field label="Passage text" error={errors.text}>
                  <div className="space-y-2">
                    <textarea
                      rows={6}
                      value={form.text}
                      onChange={(e) => update('text', e.target.value)}
                      placeholder="Type or auto-generate the passage here..."
                      className={`${inputClass(!!errors.text)} font-mono text-sm`}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {
                          form.text.trim().split(/\s+/).filter(Boolean).length
                        }{' '}
                        words · minimum 10
                      </span>
                      <button
                        type="button"
                        onClick={autoGenerate}
                        className="inline-flex items-center gap-1 font-medium text-brand transition-colors hover:text-brand/80"
                      >
                        <Sparkles className="h-3 w-3" />
                        Auto-generate from category
                      </button>
                    </div>
                  </div>
                </Field>
              </div>
              <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm(blankForm);
                    setErrors({});
                    setShowPassageForm(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Save passage</Button>
              </div>
            </form>
          )}

          {passages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface/30 px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No typing passages yet.
              </p>
            </div>
          ) : (
            <AdminTable<TypingPassage>
              rows={passages}
              rowKey={(t) => t.id}
              columns={[
                {
                  key: 'title',
                  header: 'Passage',
                  render: (t) => (
                    <span className="font-medium text-foreground">
                      {t.title}
                    </span>
                  ),
                },
                {
                  key: 'category',
                  header: 'Category',
                  render: (t) => (
                    <span className="text-muted-foreground">{t.category}</span>
                  ),
                },
                {
                  key: 'length',
                  header: 'Length',
                  render: (t) => (
                    <span className="font-mono tabular-nums text-foreground">
                      {t.length} words
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (t) => <AdminStatusBadge status={t.status} />,
                },
                {
                  key: 'actions',
                  header: '',
                  className: 'text-right',
                  render: (t) => (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setConfirmDelete({
                          kind: 'passage',
                          id: t.id,
                          label: t.title,
                        })
                      }
                      className="gap-1.5 text-destructive hover:bg-destructive/10"
                      title="Delete passage"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </section>
      )}

      {/* Tab: Site copy */}
      {tab === 'site' && (
        <section className="space-y-6">
          <Card label="Announcement">
            <p className="mb-2 text-xs text-muted-foreground">
              Shown on the student dashboard.
            </p>
            <textarea
              rows={3}
              value={site.announcement}
              onChange={(e) => setSite((s) => ({ ...s, announcement: e.target.value }))}
              className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => flash('Announcement saved (mock).')}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </Card>

          <Card label="Homepage hero">
            <p className="mb-3 text-xs text-muted-foreground">
              Headline and subheading shown on the public homepage.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={site.heroHeadline}
                onChange={(e) => setSite((s) => ({ ...s, heroHeadline: e.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <textarea
                rows={3}
                value={site.heroSubheading}
                onChange={(e) => setSite((s) => ({ ...s, heroSubheading: e.target.value }))}
                className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => flash('Homepage saved (mock).')}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </Card>

          <Card label="Class information">
            <p className="mb-3 text-xs text-muted-foreground">
              Display copy for the public Classes page.
            </p>
            <textarea
              rows={3}
              value={site.classDescription}
              onChange={(e) => setSite((s) => ({ ...s, classDescription: e.target.value }))}
              className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <div className="mt-3 flex justify-end">
              <Button
                onClick={() => flash('Class info saved (mock).')}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </Card>
        </section>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
                <AlertCircle className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {confirmDelete.kind === 'audio'
                    ? 'Clear audio file?'
                    : `Delete ${confirmDelete.kind}?`}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {confirmDelete.kind === 'audio'
                    ? `This will remove the audio file for "${confirmDelete.label}". The transcript will be kept so you can re-upload later.`
                    : confirmDelete.kind === 'dictation'
                    ? `"${confirmDelete.label}" and its transcript will be permanently removed. Students will no longer see it in their dictation list.`
                    : `The passage "${confirmDelete.label}" will be permanently removed. Students in Free mode will no longer see it.`}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (confirmDelete.kind === 'dictation') {
                    deleteDictation(confirmDelete.id);
                  } else if (confirmDelete.kind === 'passage') {
                    deletePassage(confirmDelete.id);
                  } else {
                    deleteAudio(confirmDelete.id);
                  }
                }}
                className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmDelete.kind === 'audio' ? 'Clear' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={cn(
        'flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      {label}
    </button>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h2>
      {children}
    </div>
  );
}

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
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  `h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
    hasError
      ? 'border-destructive/50 focus:border-destructive/50 focus:ring-destructive/20'
      : 'border-border focus:border-brand/40 focus:ring-brand/20'
  }`;

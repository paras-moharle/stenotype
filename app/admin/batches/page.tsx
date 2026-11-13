'use client';

import { useState } from 'react';
import { Plus, Users, Clock, X } from 'lucide-react';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
import { batches as initialBatches, type Batch } from '@/lib/admin-data';
import { batchSchema } from '@/lib/schemas';

type FormState = {
  name: string;
  schedule: string;
  time: string;
  status: 'Active' | 'Archived';
};

const blankForm: FormState = {
  name: '',
  schedule: '',
  time: '',
  status: 'Active',
};

export default function AdminBatchesPage() {
  const [rows, setRows] = useState<Batch[]>(initialBatches);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [toast, setToast] = useState<string | null>(null);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(blankForm);
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (batch: Batch) => {
    setEditingId(batch.id);
    setForm({
      name: batch.name,
      schedule: batch.schedule,
      time: batch.time,
      status: batch.status,
    });
    setErrors({});
    setShowForm(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = batchSchema.safeParse(form);
    if (!result.success) {
      const fe: Partial<Record<keyof FormState, string>> = {};
      for (const issue of result.error.issues) {
        fe[issue.path[0] as keyof FormState] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    if (editingId) {
      setRows((prev) =>
        prev.map((b) =>
          b.id === editingId
            ? {
                ...b,
                name: form.name,
                schedule: form.schedule,
                time: form.time,
                status: form.status,
              }
            : b
        )
      );
      setToast(`${form.name} updated (mock).`);
    } else {
      setRows((prev) => [
        {
          id: `b${Date.now()}`,
          name: form.name,
          students: 0,
          schedule: form.schedule,
          time: form.time,
          status: form.status,
        },
        ...prev,
      ]);
      setToast(`${form.name} created (mock).`);
    }
    setForm(blankForm);
    setEditingId(null);
    setShowForm(false);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Batches"
        description="Organise students into batches with shared schedules."
        action={
          <Button onClick={openCreate} className="gap-1.5">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'Create Batch'}
          </Button>
        }
      />

      {toast && (
        <div className="rounded-md border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
          {toast}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={submit}
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2 className="mb-5 text-base font-semibold text-foreground">
            {editingId ? 'Edit Batch' : 'New Batch'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Batch name" error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Batch E"
                className={inputClass(!!errors.name)}
              />
            </FormField>
            <FormField label="Schedule" error={errors.schedule}>
              <input
                type="text"
                value={form.schedule}
                onChange={(e) => update('schedule', e.target.value)}
                placeholder="e.g. Mon / Wed / Fri"
                className={inputClass(!!errors.schedule)}
              />
            </FormField>
            <FormField label="Time" error={errors.time}>
              <input
                type="text"
                value={form.time}
                onChange={(e) => update('time', e.target.value)}
                placeholder="e.g. 6:00 PM"
                className={inputClass(!!errors.time)}
              />
            </FormField>
            <FormField label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  update('status', e.target.value as FormState['status'])
                }
                className={inputClass(false)}
              >
                <option>Active</option>
                <option>Archived</option>
              </select>
            </FormField>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setForm(blankForm);
                setErrors({});
                setEditingId(null);
                setShowForm(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingId ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((batch) => (
          <div
            key={batch.id}
            className="rounded-lg border border-border bg-surface p-5"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {batch.name}
                </h3>
                <AdminStatusBadge status={batch.status} className="mt-2" />
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-brand">
                <Users className="h-4 w-4" strokeWidth={1.5} />
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Students</dt>
                <dd className="font-mono tabular-nums text-foreground">
                  {batch.students}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Schedule</dt>
                <dd className="text-foreground">{batch.schedule}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Time
                </dt>
                <dd className="font-mono text-foreground">{batch.time}</dd>
              </div>
            </dl>
            <div className="mt-5 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                asChild
              >
                <Link href={`/admin/students?batch=${encodeURIComponent(batch.id)}`}>
                  View Students
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEdit(batch)}
              >
                Edit
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  `h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
    hasError
      ? 'border-destructive/50 focus:border-destructive/50 focus:ring-destructive/20'
      : 'border-border focus:border-brand/40 focus:ring-brand/20'
  }`;

function FormField({
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

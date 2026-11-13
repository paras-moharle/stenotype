'use client';

import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminSearch } from '@/components/admin/admin-search';
import { Button } from '@/components/ui/button';
import {
  students as initialStudents,
  batches,
  type Student,
} from '@/lib/admin-data';
import { studentSchema } from '@/lib/schemas';

type FormState = {
  name: string;
  email: string;
  phone: string;
  batchId: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  notes: string;
};

const blankForm: FormState = {
  name: '',
  email: '',
  phone: '',
  batchId: 'b1',
  status: 'Active',
  notes: '',
};

export default function AdminStudentsPage() {
  const [query, setQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [rows, setRows] = useState<Student[]>(initialStudents);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [toast, setToast] = useState<string | null>(null);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = studentSchema.safeParse(form);
    if (!result.success) {
      const fe: Partial<Record<keyof FormState, string>> = {};
      for (const issue of result.error.issues) {
        fe[issue.path[0] as keyof FormState] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    const batchName = batches.find((b) => b.id === form.batchId)?.name ?? '—';
    setRows((prev) => [
      {
        id: `s${Date.now()}`,
        name: form.name,
        email: form.email,
        batch: batchName,
        status: form.status,
        accuracy: 0,
        avgWpm: 0,
        lastPractice: 'Never',
        fee: 'Pending',
        joinedAt: new Date().toISOString().slice(0, 10),
      },
      ...prev,
    ]);
    setForm(blankForm);
    setShowForm(false);
    setToast(`${form.name} added (mock — not saved to a database yet).`);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = useMemo(() => {
    return rows.filter((s) => {
      const matchQuery =
        !query ||
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.email.toLowerCase().includes(query.toLowerCase());
      const matchBatch = batchFilter === 'All' || s.batch === batchFilter;
      const matchStatus = statusFilter === 'All' || s.status === statusFilter;
      return matchQuery && matchBatch && matchStatus;
    });
  }, [rows, query, batchFilter, statusFilter]);

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Students"
        description="Manage enrolled students, batches, and practice status."
        action={
          <Button onClick={() => setShowForm((v) => !v)} className="gap-1.5">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'Add Student'}
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
            New Student
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className={inputClass(!!errors.name)}
              />
            </FormField>
            <FormField label="Email" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="aarav@example.com"
                className={inputClass(!!errors.email)}
              />
            </FormField>
            <FormField label="Phone (optional)" error={errors.phone}>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="+91 9876543210"
                className={inputClass(!!errors.phone)}
              />
            </FormField>
            <FormField label="Batch" error={errors.batchId}>
              <select
                value={form.batchId}
                onChange={(e) => update('batchId', e.target.value)}
                className={inputClass(!!errors.batchId)}
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
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
                <option>Inactive</option>
                <option>Suspended</option>
              </select>
            </FormField>
            <FormField label="Notes (optional)">
              <input
                type="text"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Any relevant notes..."
                className={inputClass(false)}
              />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setForm(blankForm);
                setErrors({});
                setShowForm(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit">Add Student</Button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <AdminSearch
          value={query}
          onChange={setQuery}
          placeholder="Search by name or email..."
          className="sm:max-w-xs"
        />
        <select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="All">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="All">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      <AdminTable<Student>
        rows={filtered}
        rowKey={(s) => s.id}
        columns={[
          {
            key: 'name',
            header: 'Student',
            render: (s) => (
              <div>
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </div>
            ),
          },
          {
            key: 'batch',
            header: 'Batch',
            render: (s) => <span className="text-muted-foreground">{s.batch}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (s) => <AdminStatusBadge status={s.status} />,
          },
          {
            key: 'accuracy',
            header: 'Accuracy',
            render: (s) => (
              <span className="font-mono tabular-nums text-foreground">
                {s.accuracy}%
              </span>
            ),
          },
          {
            key: 'lastPractice',
            header: 'Last Practice',
            render: (s) => (
              <span className="text-muted-foreground">{s.lastPractice}</span>
            ),
          },
          {
            key: 'fee',
            header: 'Fee',
            render: (s) => <AdminStatusBadge status={s.fee} />,
          },
        ]}
      />

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length} students.
      </p>
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

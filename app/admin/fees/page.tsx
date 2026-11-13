'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminSearch } from '@/components/admin/admin-search';
import { Button } from '@/components/ui/button';
import { fees as initialFees, type Fee } from '@/lib/admin-data';
import { feeSchema } from '@/lib/schemas';

type FormState = {
  studentId: string;
  amount: string;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  notes: string;
};

const blankForm: FormState = {
  studentId: '',
  amount: '2500',
  dueDate: '',
  status: 'Pending',
  notes: '',
};

export default function AdminFeesPage() {
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState<Fee[]>(initialFees);
  const [form, setForm] = useState<FormState>(blankForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [toast, setToast] = useState<string | null>(null);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = feeSchema.safeParse({
      studentId: form.studentId,
      amount: Number(form.amount) || 0,
      dueDate: form.dueDate,
      status: form.status,
      paidDate: form.status === 'Paid' ? new Date().toISOString().slice(0, 10) : null,
      notes: form.notes,
    });
    if (!result.success) {
      const fe: Partial<Record<keyof FormState, string>> = {};
      for (const issue of result.error.issues) {
        fe[issue.path[0] as keyof FormState] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    setRows((prev) => [
      {
        id: `f${Date.now()}`,
        student: form.studentId || 'Unknown',
        amount: Number(form.amount) || 0,
        dueDate: form.dueDate,
        status: form.status,
        paidDate:
          form.status === 'Paid' ? new Date().toISOString().slice(0, 10) : null,
        notes: form.notes,
      },
      ...prev,
    ]);
    setForm(blankForm);
    setShowForm(false);
    setToast('Fee record added (mock).');
    setTimeout(() => setToast(null), 3000);
  };

  const markPaid = (id: string) => {
    setRows((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              status: 'Paid',
              paidDate: new Date().toISOString().slice(0, 10),
            }
          : f
      )
    );
    setToast('Marked as paid (mock).');
    setTimeout(() => setToast(null), 2000);
  };

  const filtered = rows.filter(
    (f) => !query || f.student.toLowerCase().includes(query.toLowerCase())
  );

  const totalCollected = rows
    .filter((f) => f.status === 'Paid')
    .reduce((sum, f) => sum + f.amount, 0);
  const totalPending = rows
    .filter((f) => f.status === 'Pending')
    .reduce((sum, f) => sum + f.amount, 0);
  const totalOverdue = rows
    .filter((f) => f.status === 'Overdue')
    .reduce((sum, f) => sum + f.amount, 0);

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Fees"
        description="Manual fee tracking. Mark payments and review outstanding amounts."
        action={
          <Button onClick={() => setShowForm((v) => !v)} className="gap-1.5">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'Add Fee'}
          </Button>
        }
      />

      {toast && (
        <div className="rounded-md border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Collected
          </p>
          <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-success">
            ₹{totalCollected.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Pending
          </p>
          <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-brand">
            ₹{totalPending.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Overdue
          </p>
          <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-destructive">
            ₹{totalOverdue.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="rounded-lg border border-border bg-surface p-6"
        >
          <h2 className="mb-5 text-base font-semibold text-foreground">
            Add Fee Record
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Student" error={errors.studentId}>
              <input
                type="text"
                value={form.studentId}
                onChange={(e) => update('studentId', e.target.value)}
                placeholder="Student name"
                className={inputClass(!!errors.studentId)}
              />
            </FormField>
            <FormField label="Amount (₹)" error={errors.amount}>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => update('amount', e.target.value)}
                className={`${inputClass(!!errors.amount)} font-mono`}
              />
            </FormField>
            <FormField label="Due Date" error={errors.dueDate}>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => update('dueDate', e.target.value)}
                className={inputClass(!!errors.dueDate)}
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
                <option>Pending</option>
                <option>Paid</option>
                <option>Overdue</option>
              </select>
            </FormField>
            <FormField label="Notes" className="sm:col-span-2">
              <input
                type="text"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="e.g. September fee"
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
            <Button type="submit">Save</Button>
          </div>
        </form>
      )}

      <AdminSearch
        value={query}
        onChange={setQuery}
        placeholder="Search by student..."
        className="sm:max-w-xs"
      />

      <AdminTable<Fee>
        rows={filtered}
        rowKey={(f) => f.id}
        columns={[
          {
            key: 'student',
            header: 'Student',
            render: (f) => (
              <span className="font-medium text-foreground">{f.student}</span>
            ),
          },
          {
            key: 'amount',
            header: 'Amount',
            render: (f) => (
              <span className="font-mono tabular-nums text-foreground">
                ₹{f.amount.toLocaleString('en-IN')}
              </span>
            ),
          },
          {
            key: 'dueDate',
            header: 'Due Date',
            render: (f) => <span className="text-muted-foreground">{f.dueDate}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (f) => <AdminStatusBadge status={f.status} />,
          },
          {
            key: 'paidDate',
            header: 'Paid Date',
            render: (f) => (
              <span className="font-mono text-muted-foreground">
                {f.paidDate ?? '—'}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (f) =>
              f.status !== 'Paid' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markPaid(f.id)}
                >
                  Mark Paid
                </Button>
              ) : null,
          },
        ]}
      />
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
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Plus, X, Clock } from 'lucide-react';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
import {
  schedule as initial,
  type ScheduleItem,
} from '@/lib/admin-data';
import { scheduleItemSchema } from '@/lib/schemas';

type FormState = {
  dictation: string;
  audience: string;
  startDate: string;
  startTime: string;
  endTime: string;
};

const blankForm: FormState = {
  dictation: '',
  audience: 'Batch A',
  startDate: '',
  startTime: '',
  endTime: '',
};

const groupByStatus = (s: ScheduleItem[]) => {
  const groups: Record<string, ScheduleItem[]> = {
    Today: [],
    Upcoming: [],
    Past: [],
  };
  for (const item of s) {
    groups[item.status]?.push(item);
  }
  return groups;
};

const deriveStatus = (date: string): ScheduleItem['status'] => {
  if (!date) return 'Upcoming';
  const now = new Date();
  const target = new Date(date);
  if (target.toDateString() === now.toDateString()) return 'Today';
  if (target.getTime() < now.getTime()) return 'Past';
  return 'Upcoming';
};

export default function AdminSchedulePage() {
  const [rows, setRows] = useState<ScheduleItem[]>(initial);
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
    const startsAt = `${form.startDate}T${form.startTime || '00:00'}`;
    const endsAt = `${form.startDate}T${form.endTime || '00:00'}`;
    const result = scheduleItemSchema.safeParse({
      dictationId: form.dictation,
      audience: form.audience,
      startsAt,
      endsAt,
    });
    if (!result.success) {
      const fe: Partial<Record<keyof FormState, string>> = {};
      for (const issue of result.error.issues) {
        const path = String(issue.path[0]);
        if (path === 'endsAt') fe.endTime = issue.message;
        else if (path === 'startsAt') fe.startTime = issue.message;
        else if (path === 'dictationId') fe.dictation = issue.message;
        else if (path === 'audience') fe.audience = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    setRows((prev) => [
      {
        id: `sc${Date.now()}`,
        dictation: form.dictation || 'Untitled dictation',
        audience: form.audience,
        startsAt,
        endsAt,
        status: deriveStatus(startsAt),
      },
      ...prev,
    ]);
    setForm(blankForm);
    setShowForm(false);
    setToast('Session scheduled (mock).');
    setTimeout(() => setToast(null), 3000);
  };

  const groups = groupByStatus(rows);

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Schedule"
        description="Plan dictation sessions for batches and students."
        action={
          <Button onClick={() => setShowForm((v) => !v)} className="gap-1.5">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'Schedule Dictation'}
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
            New Schedule Entry
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Dictation" error={errors.dictation} className="sm:col-span-2">
              <input
                type="text"
                value={form.dictation}
                onChange={(e) => update('dictation', e.target.value)}
                placeholder="e.g. Court Proceedings — Verdict"
                className={inputClass(!!errors.dictation)}
              />
            </FormField>
            <FormField label="Audience" error={errors.audience}>
              <select
                value={form.audience}
                onChange={(e) => update('audience', e.target.value)}
                className={inputClass(!!errors.audience)}
              >
                <option>Batch A</option>
                <option>Batch B</option>
                <option>Batch C</option>
                <option>All Batches</option>
                <option>Individual Student</option>
              </select>
            </FormField>
            <FormField label="Date" error={errors.startDate}>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                className={inputClass(!!errors.startDate)}
              />
            </FormField>
            <FormField label="Start time" error={errors.startTime}>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => update('startTime', e.target.value)}
                className={`${inputClass(!!errors.startTime)} font-mono`}
              />
            </FormField>
            <FormField label="End time" error={errors.endTime}>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => update('endTime', e.target.value)}
                className={`${inputClass(!!errors.endTime)} font-mono`}
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
            <Button type="submit">Save Schedule</Button>
          </div>
        </form>
      )}

      <div className="space-y-8">
        {(['Today', 'Upcoming', 'Past'] as const).map((status) => {
          const items = groups[status];
          if (!items || items.length === 0) return null;
          return (
            <section key={status}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {status}
                </h2>
                <AdminStatusBadge status={status} />
                <span className="text-xs text-muted-foreground">
                  {items.length} session{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {item.dictation}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.audience}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {item.startsAt.split('T')[1] ?? item.startsAt} –{' '}
                      {item.endsAt.split('T')[1] ?? item.endsAt}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
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

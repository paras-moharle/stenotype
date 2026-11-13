'use client';

import { useState } from 'react';
import { Save, Check } from 'lucide-react';
import { AdminHeader } from '@/components/admin/admin-header';
import { Button } from '@/components/ui/button';
import { settingsSchema } from '@/lib/schemas';

type FormState = {
  siteName: string;
  tagline: string;
  defaultDuration: 15 | 30 | 60;
  defaultDictationStatus: 'Draft' | 'Published' | 'Archived';
  notifyOnNewStudent: boolean;
  notifyOnFeePayment: boolean;
  weeklySummary: boolean;
};

const initial: FormState = {
  siteName: 'StenoType',
  tagline: 'Dictation. Transcription. Typing.',
  defaultDuration: 30,
  defaultDictationStatus: 'Draft',
  notifyOnNewStudent: true,
  notifyOnFeePayment: true,
  weeklySummary: false,
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [toast, setToast] = useState<string | null>(null);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const save = () => {
    const result = settingsSchema.safeParse(form);
    if (!result.success) {
      const fe: Partial<Record<keyof FormState, string>> = {};
      for (const issue of result.error.issues) {
        fe[issue.path[0] as keyof FormState] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    setToast('Settings saved (mock — not persisted yet).');
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Settings"
        description="Site-wide configuration and practice defaults."
      />

      {toast && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
          <Check className="h-4 w-4" />
          {toast}
        </div>
      )}

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          Site Information
        </h2>
        <div className="space-y-4">
          <Field label="Site Name" error={errors.siteName}>
            <input
              type="text"
              value={form.siteName}
              onChange={(e) => update('siteName', e.target.value)}
              className={inputClass(!!errors.siteName)}
            />
          </Field>
          <Field label="Tagline" error={errors.tagline}>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => update('tagline', e.target.value)}
              className={inputClass(!!errors.tagline)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          Practice Defaults
        </h2>
        <div className="space-y-4">
          <Field label="Default Typing Duration" error={errors.defaultDuration}>
            <select
              value={form.defaultDuration}
              onChange={(e) =>
                update(
                  'defaultDuration',
                  Number(e.target.value) as FormState['defaultDuration']
                )
              }
              className={inputClass(!!errors.defaultDuration)}
            >
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
            </select>
          </Field>
          <Field label="Default Dictation Visibility" error={errors.defaultDictationStatus}>
            <select
              value={form.defaultDictationStatus}
              onChange={(e) =>
                update(
                  'defaultDictationStatus',
                  e.target.value as FormState['defaultDictationStatus']
                )
              }
              className={inputClass(!!errors.defaultDictationStatus)}
            >
              <option>Draft</option>
              <option>Published</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          Admin preferences
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Display preferences for the admin panel.
        </p>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-border bg-surface accent-brand"
            />
            Show full-width tables on wide screens
          </label>
          <label className="flex items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-border bg-surface accent-brand"
            />
            Compact stat cards
          </label>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} className="gap-1.5">
          <Save className="h-4 w-4" />
          Save Settings
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Authentication and security settings will be available when the
        backend phase begins.
      </p>
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  `h-10 w-full max-w-md rounded-md border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 ${
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
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

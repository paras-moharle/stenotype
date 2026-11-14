'use client';

import { StudentHeader } from '@/components/student/student-header';
import { Mail, User as UserIcon, Shield } from 'lucide-react';
import { useAuth } from '@/lib/use-auth';

export default function StudentProfilePage() {
  const { user, isLoading } = useAuth();

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // While the profile page's own auth fetch is in flight, show a
  // loading skeleton instead of flashing empty dashes.
  if (isLoading) {
    return (
      <div className="space-y-10">
        <StudentHeader
          title="My profile"
          description="Your account information and batch details."
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-6 lg:col-span-2">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl font-bold text-brand-foreground">
                AC
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Loading...
                </h2>
                <p className="text-sm text-muted-foreground">
                  Student
                </p>
              </div>
            </div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              <Row icon={Mail} label="Email" value="Loading..." />
              <Row icon={Shield} label="Role" value="Loading..." />
            </dl>
          </div>
          <div className="rounded-lg border border-border bg-surface p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Practice summary
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Practice stats are not stored yet. They will appear here once the
              database backend is connected.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <StudentHeader
        title="My profile"
        description="Your account information and batch details."
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800 font-medium">
          🚧 Under progress — profile editing and batch details are coming soon.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="rounded-lg border border-border bg-surface p-6 lg:col-span-2">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl font-bold text-brand-foreground">
              {initials || <UserIcon className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {user?.name ?? 'Signed-in user'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'admin' ? 'Administrator' : 'Student'}
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <Row
              icon={Mail}
              label="Email"
              value={user?.email ?? '—'}
            />
            <Row
              icon={Shield}
              label="Role"
              value={user?.role === 'admin' ? 'Administrator' : 'Student'}
            />
          </dl>
        </div>

        {/* Practice summary */}
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Practice summary
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Practice stats are not stored yet. They will appear here once the
            database backend is connected.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
      <Icon
        className="h-4 w-4 shrink-0 text-muted-foreground"
        strokeWidth={1.5}
      />
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-base text-foreground">{value}</p>
      </div>
    </div>
  );
}

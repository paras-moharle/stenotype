import { AdminHeader } from '@/components/admin/admin-header';
import { AdminStat } from '@/components/admin/admin-stat';
import { students, schedule } from '@/lib/admin-data';
import Link from 'next/link';
import { Activity } from 'lucide-react';

export default function AdminDashboardPage() {
  const activeStudents = students.filter((s) => s.status === 'Active').length;
  const pendingFees = students.filter(
    (s) => s.fee === 'Pending' || s.fee === 'Overdue'
  ).length;
  const todayDictations = schedule.filter((s) => s.status === 'Today').length;
  const upcomingDictations = schedule.filter(
    (s) => s.status === 'Upcoming'
  ).length;

  return (
    <div className="space-y-10">
      <AdminHeader
        title="Dashboard"
        description="Overview of students, dictations, and practice activity."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AdminStat label="Active Students" value={activeStudents} hint="Currently enrolled" />
        <AdminStat label="Pending Fees" value={pendingFees} hint="Awaiting payment" />
        <AdminStat
          label="Today's Dictations"
          value={todayDictations}
          hint="Scheduled today"
        />
        <AdminStat
          label="Upcoming"
          value={upcomingDictations}
          hint="Next 7 days"
        />
      </div>

      {/* Recent activity — not stored yet */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Activity
          </h2>
          <Link
            href="/admin/results"
            className="text-xs font-medium text-brand hover:text-brand/80"
          >
            View results →
          </Link>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-surface/30 px-6 py-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Activity className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            No activity yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Activity is not stored yet. It will appear here once the database
            backend is connected.
          </p>
        </div>
      </section>

      {/* Quick links */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: '/admin/students', label: 'Add Student' },
            { href: '/admin/dictations', label: 'New Dictation' },
            { href: '/admin/fees', label: 'Mark Fee Paid' },
            { href: '/admin/schedule', label: 'Schedule' },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-md border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-brand/40 hover:text-brand"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

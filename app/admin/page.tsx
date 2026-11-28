import { getStorageCapacity } from '@/lib/db-capacity';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminStat } from '@/components/admin/admin-stat';
import { db } from '@/lib/db';
import { dictationAttemptsWhere } from '@/lib/dictation-history';
import { formatISTDateTime } from '@/lib/datetime';
import Link from 'next/link';
import { Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const [
    totalStudents,
    activeStudents,
    publishedDictations,
    totalAttempts,
    recentAttempts,
    capacity,
  ] = await Promise.all([
    db.studentProfile.count(),
    db.studentProfile.count({ where: { status: 'ACTIVE', user: { banned: false } } }),
    db.dictation.count({ where: { status: 'PUBLISHED' } }),
    db.typingAttempt.count({ where: { ...dictationAttemptsWhere } }),
    db.typingAttempt.findMany({
      where: { ...dictationAttemptsWhere },
      take: 5,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        createdAt: true,
        wpm: true,
        accuracy: true,
        dictation: { select: { title: true } },
        student: {
          select: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    }),
    getStorageCapacity().catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Overview"
        description="Students, dictations and the saved dictation results."
      />

      {(!capacity || capacity.level !== 'normal') && (
        <p role="status" className="text-sm">
          {capacity
            ? `Storage ${capacity.level} (${capacity.percent.toFixed(1)}% of the configured allowance). Check Neon project usage.`
            : 'Storage capacity could not be checked. Check Neon project usage.'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminStat
          label="Students"
          value={totalStudents}
          hint={`${activeStudents} active`}
        />
        <AdminStat label="Dictations" value={publishedDictations} hint="published" />
        <AdminStat label="Attempts" value={totalAttempts} hint="dictation only" />
      </div>

      {/* Recent activity */}
      <div className="panel card-sheen p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <Link
            href="/admin/results"
            className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/15"
          >
            View all results
          </Link>
        </div>

        {recentAttempts.length === 0 ? (
          <p className="text-muted-foreground">
            No results saved yet. Students will appear here once they
            complete their first dictation.
          </p>
        ) : (
          <div className="space-y-3">
            {recentAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex items-center justify-between rounded-2xl border border-border/50 bg-surface/30 px-3 py-3 transition-colors hover:border-brand/20 hover:bg-surface/50"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/15">
                    <Activity className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                  <div>
                    <div className="font-medium">
                      {attempt.student.user.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {attempt.dictation?.title ?? 'Dictation unavailable'} ·{' '}
                      {formatISTDateTime(attempt.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold tabular-nums text-foreground">{attempt.wpm} WPM</div>
                  <div className="font-mono text-sm tabular-nums text-muted-foreground">
                    {attempt.accuracy}% accuracy
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


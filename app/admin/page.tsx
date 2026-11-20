import { AdminHeader } from '@/components/admin/admin-header';
import { AdminStat } from '@/components/admin/admin-stat';
import { db } from '@/lib/db';
import { formatISTDateTime } from '@/lib/datetime';
import Link from 'next/link';
import { Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  // Fetch real stats from DB.
  const [
    totalStudents,
    activeStudents,
    publishedDictations,
    totalAttempts,
    recentAttempts,
  ] = await Promise.all([
    db.studentProfile.count(),
    db.studentProfile.count({ where: { status: 'ACTIVE' } }),
    db.dictation.count({ where: { status: 'PUBLISHED' } }),
    db.typingAttempt.count({ where: { dictationId: { not: null } } }),
    db.typingAttempt.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: { dictationId: { not: null } },
      include: {
        dictation: { select: { title: true } },
        student: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Overview"
        description="Students, dictations and the latest scored attempts."
      />

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
      <div className="rounded-lg border border-border p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <Link
            href="/admin/results"
            className="text-sm text-blue-500 hover:underline"
          >
            View all results
          </Link>
        </div>

        {recentAttempts.length === 0 ? (
          <p className="text-muted-foreground">
            No typing attempts yet. Students will appear here once they
            complete their first dictation.
          </p>
        ) : (
          <div className="space-y-3">
            {recentAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex items-center justify-between border-b border-border pb-3 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {attempt.student.user.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {attempt.dictation?.title ?? 'Dictation'} ·{' '}
                      {formatISTDateTime(attempt.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{attempt.wpm} WPM</div>
                  <div className="text-sm text-muted-foreground">
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


import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { db } from '@/lib/db';
import { formatISTDateTime } from '@/lib/datetime';

export const dynamic = 'force-dynamic';

type Attempt = {
  id: string;
  wpm: number;
  accuracy: number;
  completion: number;
  wordsCorrect: number;
  wordsTotal: number;
  completed: boolean;
  createdAt: Date;
  dictation: { title: string; category: string } | null;
  student: {
    user: {
      name: string;
      email: string;
    };
  };
};

export default async function AdminResultsPage() {
  const attempts = await db.typingAttempt.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    where: {
      // Results are dictation-only; legacy rows are excluded.
      dictationId: { not: null },
    },
    include: {
      dictation: { select: { title: true, category: true } },
      student: {
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      },
    },
  });

  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (a: Attempt) => (
        <div>
          <div className="font-medium">{a.student.user.name}</div>
          <div className="text-sm text-muted-foreground">
            {a.student.user.email}
          </div>
        </div>
      ),
    },
    {
      key: 'dictation',
      header: 'Dictation',
      render: (a: Attempt) => (
        <div>
          <div className="font-medium">{a.dictation?.title ?? '—'}</div>
          <div className="text-xs text-muted-foreground">
            {a.dictation?.category ?? ''}
          </div>
        </div>
      ),
    },
    {
      key: 'wpm',
      header: 'WPM',
      render: (a: Attempt) => a.wpm,
    },
    {
      key: 'accuracy',
      header: 'Accuracy',
      render: (a: Attempt) => `${a.accuracy}%`,
    },
    {
      key: 'words',
      header: 'Words',
      render: (a: Attempt) => `${a.wordsCorrect}/${a.wordsTotal}`,
    },
    {
      key: 'completion',
      header: 'Completion',
      render: (a: Attempt) => `${a.completion}%`,
    },
    {
      key: 'completed',
      header: 'Completed',
      render: (a: Attempt) => (a.completed ? 'Yes' : 'No'),
    },
    {
      key: 'date',
      header: 'Date',
      render: (a: Attempt) =>
        formatISTDateTime(a.createdAt),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Results"
        description="Student typing attempt results"
      />

      {attempts.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
          No typing attempts yet. Results will appear here once students
          complete their first dictation.
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={attempts}
          rowKey={(a) => a.id}
        />
      )}
    </div>
  );
}


import { AdminHeader } from '@/components/admin/admin-header';
import { AdminTable } from '@/components/admin/admin-table';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Attempt = {
  id: string;
  wpm: number;
  accuracy: number;
  correctCharacters: number;
  incorrectCharacters: number;
  completed: boolean;
  createdAt: Date;
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
    include: {
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
      key: 'correct',
      header: 'Correct',
      render: (a: Attempt) => a.correctCharacters,
    },
    {
      key: 'incorrect',
      header: 'Incorrect',
      render: (a: Attempt) => a.incorrectCharacters,
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
        new Date(a.createdAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
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


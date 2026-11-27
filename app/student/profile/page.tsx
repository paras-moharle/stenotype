import { StudentHeader } from '@/components/student/student-header';
import { Mail, User as UserIcon, Shield } from 'lucide-react';
import { requireStudentPage } from '@/lib/student-session';
import { dictationAttemptStats } from '@/lib/dictation-history';

export default async function StudentProfilePage() {
  const { user, profile } = await requireStudentPage();
  const stats = await dictationAttemptStats(profile.id);

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-10">
      <StudentHeader
        title="My profile"
        description="Your account information."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="panel card-sheen p-6 lg:col-span-2">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-2xl font-bold text-brand shadow-lg ">
              {initials || <UserIcon className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {user?.name || 'Student'}
              </h2>
              <p className="text-sm text-muted-foreground">Student</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <Row icon={Mail} label="Email" value={user?.email || '—'} />
            <Row icon={Shield} label="Role" value="Student" />
          </dl>
        </div>

        {/* Practice summary */}
        <div className="panel card-sheen p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Practice summary
          </h2>
          {stats && stats.totalAttempts > 0 ? (
            <div className="mt-4 space-y-3">
              <StatRow label="All attempts" value={stats.totalAttempts} />
              <StatRow label="Average WPM" value={stats.avgWpm} />
              <StatRow label="Average accuracy" value={`${stats.avgAccuracy}%`} />
              <StatRow label="Best WPM" value={stats.bestWpm} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No attempts yet. Complete a dictation to see your stats here.
            </p>
          )}
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
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}


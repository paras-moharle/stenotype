import { StudentCta, StudentStatusBadge } from '@/components/student/student-header';
import { StudentGreeting } from '@/components/student/student-greeting';
import { assignedDictations } from '@/lib/student-data';
import Link from 'next/link';
import { Headphones, BarChart3, Keyboard, Clock } from 'lucide-react';

export default function StudentDashboardPage() {
  const now = new Date();
  const available = assignedDictations
    .filter(
      (d) =>
        new Date(d.availableFrom) <= now && new Date(d.availableUntil) >= now
    )
    .slice(0, 6);

  return (
    <div className="space-y-10">
      <StudentGreeting description="Pick up where you left off, or jump into a new dictation." />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800 font-medium">
          🚧 Under progress — results are not stored yet.
        </p>
        <p className="mt-1 text-xs text-amber-700">
          Scores are shown on the typing page for the current test only and are
          cleared on refresh. Saved progress will appear here once the database
          is connected.
        </p>
      </div>

      {/* Shortcuts */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick practice
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ShortcutCard
            icon={Headphones}
            title="Assigned dictations"
            description="10 test dictations in blind mode"
            href="/student/dictations"
          />
          <ShortcutCard
            icon={Keyboard}
            title="Custom typing"
            description="Paste your own text and practice"
            href="/student/typing?mode=custom"
          />
          <ShortcutCard
            icon={BarChart3}
            title="My results"
            description="Results are not stored yet"
            href="/student/results"
          />
        </div>
      </section>

      {/* Test dictations */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Test dictations
          </h2>
          <StudentCta href="/student/dictations" label="View all" />
        </div>
        {available.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No dictations available right now.
          </div>
        ) : (
          <ul className="space-y-2">
            {available.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {d.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {d.duration} · {d.category}
                    </p>
                  </div>
                  <StudentStatusBadge status={d.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ShortcutCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-brand/40"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-brand">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

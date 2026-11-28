import { StudentGreeting } from '@/components/student/student-greeting';
import { db } from '@/lib/db';
import { dictationAttemptsWhere } from '@/lib/dictation-history';
import { requireStudentPage } from '@/lib/student-session';
import { formatISTDate } from '@/lib/datetime';
import Link from 'next/link';
import { Headphones, BarChart3, Keyboard, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function StudentDashboardPage() {
  const { profile } = await requireStudentPage();
  const attemptWhere = { ...dictationAttemptsWhere, studentId: profile.id };
  const [recentAttempts, availableDictations] = await Promise.all([
    db.typingAttempt.findMany({
      where: attemptWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
      select: {
        id: true,
        wpm: true,
        accuracy: true,
        createdAt: true,
        dictation: { select: { title: true } },
      },
    }),
    db.dictation.findMany({
      where: { status: 'PUBLISHED' },
      take: 6,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, title: true, category: true },
    }),
  ]);

  return (
    <div className="space-y-10">
      <StudentGreeting description="Pick up where you left off, or jump into a new dictation." />

      {/* Shortcuts */}
      <section>
        <h2 className="section-label">
          Quick practice
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ShortcutCard
            icon={Headphones}
            title="Dictations"
            description="Practice with audio dictations"
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
            description="Review your saved dictation results"
            href="/student/results"
          />
        </div>
      </section>

      {/* Available dictations */}
      {availableDictations.length > 0 && (
        <section>
          <h2 className="section-label">
            Available dictations
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableDictations.map((dictation) => (
              <Link
                key={dictation.id}
                href={`/student/typing?mode=dictation&dictationId=${dictation.id}`}
                className="card-sheen group rounded-3xl border border-border/70 bg-brand-soft p-5 shadow-card transition-all duration-300  hover:border-brand/30 hover:shadow-pop"
              >
                <div className="mb-2">
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand shadow-sm shadow-brand/20">
                    Dictation
                  </span>
                </div>
                <h3 className="font-medium text-foreground transition-colors group-hover:text-brand">{dictation.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {dictation.category}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Saved results */}
      {recentAttempts.length > 0 && (
        <section>
          <h2 className="section-label">
            Saved results
          </h2>
          <div className="space-y-2">
            {recentAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="card flex flex-wrap items-center justify-between gap-2 p-3 transition-colors hover:border-brand/25"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/15">
                    <TrendingUp className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                  <div>
                    <div className="font-mono font-semibold tabular-nums text-foreground">{attempt.wpm} net WPM</div>
                    <div className="text-sm text-muted-foreground">
                      {attempt.accuracy}% attempted accuracy
                      {attempt.dictation ? ` · ${attempt.dictation.title}` : ''}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatISTDate(attempt.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ShortcutCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="card-sheen group rounded-3xl border border-border/70 bg-brand-soft p-5 shadow-card transition-all duration-300  hover:border-brand/30 hover:shadow-pop"
    >
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand ring-1 ring-brand/20 transition-transform duration-300 group-hover:scale-105">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="font-medium text-foreground transition-colors group-hover:text-brand">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}


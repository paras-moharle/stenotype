import { StudentCta } from '@/components/student/student-header';
import { StudentGreeting } from '@/components/student/student-greeting';
import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { Headphones, BarChart3, Keyboard, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function StudentDashboardPage() {
  // Get the current user and their stats.
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  let stats = {
    totalAttempts: 0,
    avgWpm: 0,
    avgAccuracy: 0,
    bestWpm: 0,
  };
  let recentAttempts: {
    id: string;
    wpm: number;
    accuracy: number;
    createdAt: Date;
  }[] = [];
  let availableDictations: {
    id: string;
    title: string;
    category: string;
    youtubeId: string | null;
  }[] = [];

  if (session?.user) {
    const profile = await db.studentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (profile) {
      const [attempts, dictations] = await Promise.all([
        db.typingAttempt.findMany({
          where: { studentId: profile.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        db.dictation.findMany({
          where: { status: 'PUBLISHED' },
          take: 6,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            category: true,
            youtubeId: true,
          },
        }),
      ]);

      recentAttempts = attempts;
      availableDictations = dictations;

      if (attempts.length > 0) {
        const aggregates = await db.typingAttempt.aggregate({
          where: { studentId: profile.id },
          _count: { _all: true },
          _avg: { wpm: true, accuracy: true },
          _max: { wpm: true },
        });
        stats = {
          totalAttempts: aggregates._count._all,
          avgWpm: Math.round(aggregates._avg.wpm ?? 0),
          avgAccuracy: Math.round(aggregates._avg.accuracy ?? 0),
          bestWpm: aggregates._max.wpm ?? 0,
        };
      }
    }
  }

  return (
    <div className="space-y-10">
      <StudentGreeting description="Pick up where you left off, or jump into a new dictation." />

      {/* Stats */}
      {stats.totalAttempts > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Your progress
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border p-5 hover-lift animate-fade-in">
              <div className="text-3xl font-extrabold text-brand">{stats.totalAttempts}</div>
              <div className="text-sm text-muted-foreground">Attempts</div>
            </div>
            <div className="rounded-2xl border border-border p-5 hover-lift animate-fade-in">
              <div className="text-3xl font-extrabold text-brand">{stats.avgWpm}</div>
              <div className="text-sm text-muted-foreground">Avg WPM</div>
            </div>
            <div className="rounded-2xl border border-border p-5 hover-lift animate-fade-in">
              <div className="text-3xl font-extrabold text-brand">{stats.avgAccuracy}%</div>
              <div className="text-sm text-muted-foreground">Avg Accuracy</div>
            </div>
            <div className="rounded-2xl border border-border p-5 hover-lift animate-fade-in">
              <div className="text-3xl font-extrabold text-brand">{stats.bestWpm}</div>
              <div className="text-sm text-muted-foreground">Best WPM</div>
            </div>
          </div>
        </section>
      )}

      {/* Shortcuts */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
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
            description="View your typing history"
            href="/student/results"
          />
        </div>
      </section>

      {/* Available dictations */}
      {availableDictations.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Available dictations
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableDictations.map((dictation) => (
              <Link
                key={dictation.id}
                href={`/student/typing?mode=dictation&dictationId=${dictation.id}`}
                className="rounded-3xl border border-border bg-card p-5 hover:border-brand hover-lift animate-fade-in transition-all"
              >
                <div className="mb-2">
                  <span className="rounded bg-brand px-2 py-1 text-xs font-bold text-brand-foreground">
                    DICTATION
                  </span>
                </div>
                <h3 className="font-medium">{dictation.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {dictation.category}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent attempts */}
      {recentAttempts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent attempts
          </h2>
          <div className="space-y-2">
            {recentAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{attempt.wpm} WPM</div>
                    <div className="text-sm text-muted-foreground">
                      {attempt.accuracy}% accuracy
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(attempt.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
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
      className="rounded-3xl border border-border bg-card p-5 hover:border-brand hover-lift animate-fade-in transition-all"
    >
      <Icon className="mb-2 h-6 w-6 text-brand" />
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}


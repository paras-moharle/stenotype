import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { formatISTDateTime } from '@/lib/datetime';
import { requireStudentPage } from '@/lib/student-session';
import { StudentHeader } from '@/components/student/student-header';
import { HistoricalReview } from '@/components/typing/historical-review';

export default async function AttemptDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireStudentPage();
  const attempt = await db.typingAttempt.findFirst({
    where: { id, studentId: profile.id },
    select: {
      typedText: true, referenceSnapshot: true, reference: { select: { transcript: true } },
      rawWpm: true, wpm: true, accuracy: true, completion: true, createdAt: true,
      dictation: { select: { title: true } },
    },
  });
  if (!attempt) notFound();
  const reference = attempt.reference?.transcript ?? attempt.referenceSnapshot;

  return (
    <div className="space-y-6">
      <Link href="/student/results" className="shell-nav-link">All results</Link>
      <StudentHeader title={attempt.dictation?.title ?? 'Dictation result'} description={formatISTDateTime(attempt.createdAt)} />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Net WPM', attempt.wpm], ['Gross WPM', attempt.rawWpm ?? '—'],
          ['Attempted accuracy', `${attempt.accuracy}%`], ['Passage completion', `${attempt.completion}%`],
        ].map(([label, value]) => <div key={label} className="stat"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="stat-value mt-2">{value}</dd></div>)}
      </dl>
      {reference != null ? <HistoricalReview reference={reference} typed={attempt.typedText} /> : (
        <section className="panel space-y-3 p-5">
          <h2 className="text-h2 font-semibold">Saved transcription</h2>
          <p className="text-sm text-muted-foreground">The historical reference was unavailable for this attempt.</p>
          <p className="whitespace-pre-wrap wrap-break-word font-mono">{attempt.typedText}</p>
        </section>
      )}
    </div>
  );
}

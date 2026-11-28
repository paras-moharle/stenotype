import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminHeader } from '@/components/admin/admin-header';
import { HistoricalReview } from '@/components/typing/historical-review';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { db } from '@/lib/db';
import { formatISTDateTime } from '@/lib/datetime';

export default async function AdminResult({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const result = await db.typingAttempt.findUnique({
    where: { id },
    select: {
      dictation: { select: { title: true } }, student: { select: { id: true, user: { select: { name: true } } } },
      reference: { select: { transcript: true } }, referenceSnapshot: true, typedText: true,
      wpm: true, rawWpm: true, completion: true, accuracy: true, createdAt: true,
    },
  });
  if (!result) notFound();
  const reference = result.reference?.transcript ?? result.referenceSnapshot;
  return <section className="space-y-6">
    <AdminHeader title={result.dictation.title} description={`${result.student.user.name} · ${formatISTDateTime(result.createdAt)}`} />
    <Link className="underline" href={`/admin/results?student=${encodeURIComponent(result.student.id)}`}>Results for this student</Link>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        ['Net WPM', result.wpm], ['Gross WPM', result.rawWpm ?? '—'],
        ['Attempted accuracy', `${result.accuracy}%`], ['Passage covered', `${result.completion}%`],
      ].map(([label, value]) => <div key={label} className="stat">
        <dt className="text-sm text-muted-foreground">{label}</dt><dd className="stat-value">{value}</dd>
      </div>)}
    </dl>
    {reference !== null ? <HistoricalReview reference={reference} typed={result.typedText} /> :
      <div className="panel space-y-2 p-5">
        <p>The saved reference is unavailable for this result.</p>
        <p className="whitespace-pre-wrap wrap-anywhere font-mono">{result.typedText}</p>
      </div>}
  </section>;
}

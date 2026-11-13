import TypingClient from '@/components/typing/typing-client';
import { StudentHeader } from '@/components/student/student-header';

type Mode = 'free' | 'dictation' | 'custom';

export default function StudentTypingPage({
  searchParams,
}: {
  searchParams?: Promise<{ dictationId?: string; mode?: string }>;
}) {
  return (
    <div className="space-y-6">
      <StudentHeader
        title="Typing"
        description="Practice with your own text, assigned dictations, or curated passages."
      />
      <TypingClientAsync searchParams={searchParams} />
    </div>
  );
}

async function TypingClientAsync({
  searchParams,
}: {
  searchParams?: Promise<{ dictationId?: string; mode?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;

  const mode: Mode =
    params?.mode === 'custom'
      ? 'custom'
      : params?.mode === 'free'
      ? 'free'
      : params?.mode === 'dictation' || params?.dictationId
      ? 'dictation'
      : 'dictation';

  return (
    <TypingClient
      variant="student"
      initialMode={mode}
      initialDictationId={params?.dictationId}
    />
  );
}

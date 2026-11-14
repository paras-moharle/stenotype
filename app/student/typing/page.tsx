'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TypingClient from '@/components/typing/typing-client';
import { StudentHeader } from '@/components/student/student-header';

type Mode = 'free' | 'dictation' | 'custom';

function StudentTypingContent() {
  const searchParams = useSearchParams();
  const dictationId = searchParams.get('dictationId') ?? undefined;
  const modeParam = searchParams.get('mode');

  const mode: Mode =
    modeParam === 'custom'
      ? 'custom'
      : modeParam === 'free'
      ? 'free'
      : modeParam === 'dictation' || dictationId
      ? 'dictation'
      : 'free';

  return (
    <div className="space-y-6">
      <StudentHeader
        title="Typing"
        description="Practice with your own text, assigned dictations, or curated passages."
      />
      <TypingClient
        variant="student"
        initialMode={mode}
        initialDictationId={dictationId}
      />
    </div>
  );
}

export default function StudentTypingPage() {
  return (
    <Suspense fallback={null}>
      <StudentTypingContent />
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TypingClient from '@/components/typing/typing-client';
import { StudentHeader } from '@/components/student/student-header';

type Mode = 'free' | 'dictation' | 'custom';

function StudentTypingContent() {
  const searchParams = useSearchParams();
  const dictationId = searchParams.get('dictationId') ?? undefined;
  const from = searchParams.get('from');
  const libraryHref = from?.startsWith('/student/dictations?') ? '/student/dictations?' + new URLSearchParams(from.slice('/student/dictations?'.length)) : undefined;
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
    <div className="min-w-0 space-y-4 pb-8 sm:space-y-5">
      <StudentHeader
        title="Typing"
        description="Practice with your own text, published dictations, or curated passages."
      />
      <TypingClient
        key={JSON.stringify([mode, dictationId])}
        libraryHref={libraryHref}
        variant="student"
        initialMode={mode}
        initialDictationId={dictationId}
      />
    </div>
  );
}

function TypingPageFallback() {
  return (
    <div className="space-y-4" aria-label="Loading typing practice">
      <div className="space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-surface" />
        <div className="h-8 w-44 animate-pulse rounded-lg bg-surface" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-surface" />
      </div>
      <div className="h-24 animate-pulse rounded-2xl border border-border/70 bg-surface/60" />
      <div className="h-72 animate-pulse rounded-2xl border border-border/70 bg-surface/60" />
    </div>
  );
}

export default function StudentTypingPage() {
  return (
    <Suspense fallback={<TypingPageFallback />}>
      <StudentTypingContent />
    </Suspense>
  );
}

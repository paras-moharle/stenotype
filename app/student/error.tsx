'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Segment error boundary for the student area.
 *
 * Without this, any failed query (a revoked session mid-render, a
 * database hiccup) replaced the whole app with Next's generic error
 * page. This keeps the user inside the product and offers a retry.
 */
export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page could not be loaded. Your saved results are safe — try again.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset} className="rounded-xl">
          Try again
        </Button>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/student/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

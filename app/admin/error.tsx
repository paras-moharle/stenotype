'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Segment error boundary for the admin area.
 *
 * An admin action that fails to render (a constraint error, a database
 * hiccup) used to take down the whole dashboard with Next's generic
 * error page.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        This admin page failed to load
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nothing was changed. Retry the page, or go back to the overview.
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
          <Link href="/admin">Back to overview</Link>
        </Button>
      </div>
    </div>
  );
}

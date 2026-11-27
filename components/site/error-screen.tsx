'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorScreenProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Shared route error boundary for the public site and the app root. */
export function ErrorScreen({ error, reset }: ErrorScreenProps) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="relative isolate flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">

      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-destructive ring-1 ring-destructive/25">
        <AlertTriangle className="h-6 w-6" strokeWidth={1.6} />
      </div>
      <h1 className="editorial-title text-foreground">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-body-fluid text-muted-foreground">
        An unexpected error occurred. You can try again, or head back to the
        homepage.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-muted-foreground/70">
          ref: {error.digest}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset} className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}

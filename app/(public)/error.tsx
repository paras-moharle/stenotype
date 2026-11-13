'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
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
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}

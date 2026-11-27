import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shared 404 screen. Rendered by the root not-found boundary (for URLs
 * that match no route) and by the public route group (for `notFound()`
 * calls inside pages).
 */
export function NotFoundScreen() {
  return (
    <div className="relative isolate flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">

      <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand ring-1 ring-brand/20">
        <Compass className="h-6 w-6" strokeWidth={1.6} />
      </span>

      <h1 className="editorial-title mt-3 font-semibold text-foreground">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-body-fluid text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Check the URL or head back to the homepage.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/">
            Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
}

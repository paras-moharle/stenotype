import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center py-16 text-center">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brand">
        404
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved. Check the
        URL or head back to the homepage.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Start Practicing</Link>
        </Button>
      </div>
    </div>
  );
}

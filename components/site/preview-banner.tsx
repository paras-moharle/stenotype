'use client';

import { usePathname } from 'next/navigation';
import { Info } from 'lucide-react';

export function PreviewBanner() {
  const pathname = usePathname();

  if (pathname === '/') return null;

  return (
    <div className="border-b border-warning/15 bg-background/80 px-4 py-2">
      <div className="container-page flex items-center justify-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
          <Info className="h-3.5 w-3.5" strokeWidth={1.7} />
        </span>
        <p className="text-center text-[11px] leading-relaxed sm:text-xs">
          <span className="font-semibold text-warning">Preview build</span>
          <span className="text-muted-foreground">
            {' '}
            · Accounts and saved results are still in progress. Typing practice
            is available now.
          </span>
        </p>
      </div>
    </div>
  );
}


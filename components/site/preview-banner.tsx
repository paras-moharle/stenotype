'use client';

import { usePathname } from 'next/navigation';

/**
 * Preview notice for the public site. Hidden on the home page so the
 * typing experience stays clean — the home page already surfaces a
 * small "session-only results" footnote via the typing engine.
 */
export function PreviewBanner() {
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
      🚧 Preview build — saved results and accounts are under progress.
      Typing practice works now.
    </div>
  );
}

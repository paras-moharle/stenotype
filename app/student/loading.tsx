/**
 * Instant navigation feedback for every /student/* page.
 *
 * Without a loading boundary Next has to finish the whole server
 * render before the screen changes, which is what made tab taps feel
 * dead on mobile. This renders immediately while the page streams in.
 */
export default function StudentLoading() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="space-y-3 border-b border-border pb-6">
        <div className="h-3 w-24 animate-pulse rounded-full bg-border/70" />
        <div className="h-7 w-56 animate-pulse rounded-lg bg-border/70" />
        <div className="h-3 w-72 animate-pulse rounded-full bg-border/50" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl border border-border bg-surface/60"
          />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl border border-border bg-surface/40"
          />
        ))}
      </div>
    </div>
  );
}

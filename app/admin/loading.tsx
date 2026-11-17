/**
 * Instant navigation feedback for every /admin/* page.
 *
 * See app/student/loading.tsx — same reasoning: without a loading
 * boundary the old screen stays frozen until the server finishes.
 */
export default function AdminLoading() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="space-y-3 border-b border-border pb-6">
        <div className="h-3 w-24 animate-pulse rounded-full bg-border/70" />
        <div className="h-7 w-56 animate-pulse rounded-lg bg-border/70" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl border border-border bg-surface/60"
          />
        ))}
      </div>

      <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface/40" />
    </div>
  );
}

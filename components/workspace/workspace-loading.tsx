export function WorkspaceLoading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <p role="status" className="sr-only">Loading workspace</p>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-3 border-b border-border pb-5">
          <div className="h-9 w-56 max-w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => <div key={tile} className="h-24 animate-pulse rounded-xl border border-border bg-surface" />)}
        </div>
        <div className="h-56 animate-pulse rounded-xl border border-border bg-surface" />
      </div>
    </div>
  );
}

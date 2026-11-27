export default function LoadingDictations() {
  return <div role="status" className="panel space-y-3 p-5">
    <p className="font-medium">Loading dictations…</p>
    <div aria-hidden="true" className="h-12 rounded-xl bg-muted motion-safe:animate-pulse" />
    <div aria-hidden="true" className="h-12 rounded-xl bg-muted motion-safe:animate-pulse" />
  </div>;
}

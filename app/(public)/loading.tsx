export default function Loading() {
  return (
    <div className="container-page flex min-h-[calc(100vh-8rem)] items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-brand" />
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Loading
        </p>
      </div>
    </div>
  );
}

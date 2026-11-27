export function PageHeading({ title, description, action }: {
  title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <header className="shell-heading flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1>{title}</h1>
        {description && <p className="mt-2 text-base text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </header>
  );
}

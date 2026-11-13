import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function StudentHeader({ title, description, action }: StudentHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Link
          href="/typing"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          View public site
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

interface StudentStatProps {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}

export function StudentStat({ label, value, hint, className }: StudentStatProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-5', className)}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StudentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Completed: 'border-success/30 bg-success/10 text-success',
    'In progress': 'border-brand/30 bg-brand/10 text-brand',
    'Not started': 'border-border bg-muted text-muted-foreground',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider',
        styles[status] ?? 'border-border bg-muted text-muted-foreground'
      )}
    >
      {status}
    </span>
  );
}

export function StudentCta({
  href,
  label,
  external = false,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  const Icon = external ? ExternalLink : ArrowRight;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-brand/80"
    >
      {label}
      <Icon className="h-3.5 w-3.5" />
    </Link>
  );
}

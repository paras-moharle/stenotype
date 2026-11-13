import { cn } from '@/lib/utils';

type StatusKind =
  | 'Paid'
  | 'Pending'
  | 'Overdue'
  | 'Active'
  | 'Inactive'
  | 'Suspended'
  | 'Draft'
  | 'Published'
  | 'Archived'
  | 'Today'
  | 'Upcoming'
  | 'Past';

interface AdminStatusBadgeProps {
  status: StatusKind | string;
  className?: string;
}

const styles: Record<string, string> = {
  Paid: 'border-success/30 bg-success/10 text-success',
  Active: 'border-success/30 bg-success/10 text-success',
  Published: 'border-success/30 bg-success/10 text-success',
  Today: 'border-brand/30 bg-brand/10 text-brand',
  Pending: 'border-brand/30 bg-brand/10 text-brand',
  Upcoming: 'border-brand/30 bg-brand/10 text-brand',
  Inactive: 'border-border bg-muted text-muted-foreground',
  Suspended: 'border-border bg-muted text-muted-foreground',
  Draft: 'border-border bg-muted text-muted-foreground',
  Past: 'border-border bg-muted text-muted-foreground',
  Archived: 'border-border bg-muted text-muted-foreground',
  Overdue: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function AdminStatusBadge({ status, className }: AdminStatusBadgeProps) {
  const s = styles[status] ?? 'border-border bg-muted text-muted-foreground';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider',
        s,
        className
      )}
    >
      {status}
    </span>
  );
}

import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface AdminEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: AdminEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/30 px-6 py-16 text-center',
        className
      )}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
        {icon ?? <Inbox className="h-4 w-4" strokeWidth={1.5} />}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

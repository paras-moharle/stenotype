import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: 'correct' | 'incorrect' | 'pending' | 'active' | 'complete';
  children: React.ReactNode;
  className?: string;
}

const statusStyles: Record<StatusBadgeProps['status'], string> = {
  correct: 'border-success/20 bg-success/10 text-success',
  incorrect: 'border-destructive/20 bg-destructive/10 text-destructive',
  pending: 'border-border bg-muted text-muted-foreground',
  active: 'border-brand/20 bg-brand/10 text-brand',
  complete: 'border-foreground/15 bg-foreground/5 text-foreground',
};

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', statusStyles[status], className)}
    >
      {children}
    </Badge>
  );
}

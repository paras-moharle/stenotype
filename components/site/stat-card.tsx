import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
}

export function StatCard({ label, value, unit, className }: StatCardProps) {
  return (
    <Card
      className={cn(
        'border-border bg-card px-5 py-4 shadow-none',
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-foreground">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
    </Card>
  );
}

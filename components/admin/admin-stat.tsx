import { cn } from '@/lib/utils';

interface AdminStatProps {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}

export function AdminStat({ label, value, hint, className }: AdminStatProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface p-5',
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

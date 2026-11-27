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
        'stat card-sheen relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/25',
        className
      )}
    >
      <p className="stat-label">{label}</p>
      <p className="stat-value mt-2">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

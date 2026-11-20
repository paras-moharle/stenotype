import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminSearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function AdminSearch({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: AdminSearchProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.5}
      />
      <input
        type="text"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}

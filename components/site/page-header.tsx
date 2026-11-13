import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow && (
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-brand">
          {eyebrow}
        </p>
      )}
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-balance">
          {description}
        </p>
      )}
    </div>
  );
}

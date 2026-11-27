import Link from 'next/link';
import { Button } from './button';

export function ResultsPagination({ path, page, hasMore, filters, label = 'Results pages' }: { path: string; page: number; hasMore: boolean; filters?: Record<string, string>; label?: string }) {
  const link = (next: number) => `${path}?${new URLSearchParams({ ...filters, page: String(next) })}`;
  if (page === 1 && !hasMore) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-3 text-sm">
      {page > 1 && <Button asChild variant="outline"><Link href={link(page - 1)} prefetch={false}>Previous</Link></Button>}
      <span className="tabular-nums text-muted-foreground">Page {page}</span>
      {hasMore && page < 1_000 && <Button asChild variant="outline"><Link href={link(page + 1)} prefetch={false}>Next</Link></Button>}
    </nav>
  );
}

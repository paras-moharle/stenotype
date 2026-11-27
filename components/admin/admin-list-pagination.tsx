import { Button } from '@/components/ui/button';

export function AdminListPagination({ page, more, onPage }: {
  page: number;
  more: boolean;
  onPage: (page: number) => void;
}) {
  if (page === 1 && !more) return null;
  return (
    <nav aria-label="List pages" className="flex flex-wrap items-center gap-3 text-sm">
      <Button variant="outline" disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</Button>
      <span aria-live="polite" className="tabular-nums text-muted-foreground">Page {page}</span>
      <Button variant="outline" disabled={!more} onClick={() => onPage(page + 1)}>Next</Button>
    </nav>
  );
}

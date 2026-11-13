import { cn } from '@/lib/utils';

interface AdminTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  className?: string;
}

export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  className,
}: AdminTableProps<T>) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg border border-border',
        className
      )}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'whitespace-nowrap px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface/40"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'whitespace-nowrap px-4 py-3.5 text-foreground',
                    col.className
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

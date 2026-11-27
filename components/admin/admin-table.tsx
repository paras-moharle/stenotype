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
  className?: string;
}

export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  className,
}: AdminTableProps<T>) {
  return (
    <div role="region" aria-label="Scrollable results table" tabIndex={0}
      className={cn(
        'table-wrap',
        className
      )}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="table-head border-b border-border">
            {columns.map((col) => (
              <th scope="col"
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
              className="table-row"
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


import type { ReactNode } from 'react';

export function AdminFilterToolbar({ children }: { children: ReactNode }) {
  return <div className="admin-filter-toolbar">{children}</div>;
}

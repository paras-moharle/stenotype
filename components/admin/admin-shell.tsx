'use client';

import { usePathname } from 'next/navigation';
import { WorkspaceShell } from '@/components/workspace/workspace-shell';

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell role="admin" pathname={usePathname()} contentClass="container-page min-w-0 py-6 sm:py-9">
      {children}
    </WorkspaceShell>
  );
}

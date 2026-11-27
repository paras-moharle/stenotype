'use client';

import { usePathname } from 'next/navigation';
import { WorkspaceShell } from '@/components/workspace/workspace-shell';

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = pathname?.startsWith('/student/typing') ?? false;

  return (
    <WorkspaceShell role="student" pathname={pathname} contentClass={`min-w-0 py-6 sm:py-9 ${wide ? 'container-typing' : 'container-page'}`}>
      {children}
    </WorkspaceShell>
  );
}

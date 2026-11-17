'use client';

import { usePathname } from 'next/navigation';
import { AdminSidebar } from './admin-sidebar';
import { AdminMobileNav } from './admin-mobile-nav';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Auth is enforced server-side in app/admin/layout.tsx.
  return (
    <div className="flex min-h-[calc(100dvh-4rem)]">
      <AdminSidebar pathname={pathname} />
      <div className="flex-1">
        <AdminMobileNav pathname={pathname} />
        <div className="container-page py-8 lg:py-10">
          {children}
        </div>
      </div>
    </div>
  );
}

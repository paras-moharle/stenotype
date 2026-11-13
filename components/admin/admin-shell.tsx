'use client';

import { usePathname } from 'next/navigation';
import { AdminSidebar } from './admin-sidebar';
import { AdminMobileNav } from './admin-mobile-nav';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar pathname={pathname} />
      <div className="flex-1">
        <AdminMobileNav pathname={pathname} />
        <div className="container-page py-8 lg:py-10">
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800 font-medium">
              🚧 Admin panel under progress — changes are not saved yet.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              The real database backend is being connected. Data shown is
              demo-only and will reset on refresh.
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

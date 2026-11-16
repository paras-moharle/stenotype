'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { AdminMobileNav } from './admin-mobile-nav';
import { useAuth } from '@/lib/use-auth';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Don't block navigation - layout handles auth server-side

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
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


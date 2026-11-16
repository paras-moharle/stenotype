'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { StudentSidebar } from './student-sidebar';
import { StudentMobileNav } from './student-mobile-nav';
import { useAuth } from '@/lib/use-auth';

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Don't block navigation - layout handles auth server-side
  // Just show content, API calls will return 401 if session expired

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <StudentSidebar pathname={pathname} />
      <div className="min-w-0 flex-1">
        <div className="container-page py-6 pb-20 sm:py-8 lg:py-10 md:pb-10">
          {children}
        </div>
      </div>
      <StudentMobileNav pathname={pathname} />
    </div>
  );
}


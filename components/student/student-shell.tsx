'use client';

import { usePathname } from 'next/navigation';
import { StudentSidebar } from './student-sidebar';
import { StudentMobileNav } from './student-mobile-nav';

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Auth is enforced server-side in app/student/layout.tsx. The shell
  // only handles layout, so navigation never waits on a client check.
  return (
    <div className="flex min-h-[calc(100dvh-4rem)]">
      <StudentSidebar pathname={pathname} />
      <div className="min-w-0 flex-1">
        <div className="container-page py-6 pb-24 sm:py-8 lg:py-10 md:pb-10">
          {children}
        </div>
      </div>
      <StudentMobileNav pathname={pathname} />
    </div>
  );
}

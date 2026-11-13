'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StudentTopbar } from '@/components/student/student-topbar';
import { StudentShell } from '@/components/student/student-shell';
import { useAuth } from '@/lib/use-auth';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/mock-login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-brand" />
          <p className="text-sm text-muted-foreground">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <StudentTopbar />
      <StudentShell>{children}</StudentShell>
    </div>
  );
}

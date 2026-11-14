'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';
import { useAuth } from '@/lib/use-auth';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user?.role !== 'admin') {
      router.replace('/student/dashboard');
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) return null;
  if (!isAuthenticated || user?.role !== 'admin') return null;

  return (
    <div className="flex min-h-screen flex-col">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}

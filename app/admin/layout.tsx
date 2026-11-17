import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';
import { getCurrentUser } from '@/lib/session';

/**
 * Server-side session + role gate (Better Auth). Runs on every
 * request, so a revoked or banned session is caught immediately —
 * no stale cached client state. proxy.ts is the first (presence)
 * gate; this is the authoritative one.
 *
 * See app/student/layout.tsx for why denied sessions go to
 * /login?denied=1 instead of /login.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentUser();
  if (!current) {
    redirect('/login');
  }
  if (current.role !== 'admin' || current.banned) {
    redirect('/login?denied=1');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}

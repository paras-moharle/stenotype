import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { AdminShell } from '@/components/admin/admin-shell';

/**
 * Server-side session + role gate (Better Auth). Runs on every
 * request, so a revoked or banned session is caught immediately —
 * no stale cached client state. proxy.ts is the first (presence)
 * gate; this is the authoritative one.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    redirect('/login');
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, banned: true },
  });
  if (!dbUser || dbUser.role !== 'admin' || dbUser.banned) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}


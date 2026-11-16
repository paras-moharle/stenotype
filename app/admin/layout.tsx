import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';
import {
  SESSION_COOKIE,
  verifySession,
  getUserByEmail,
} from '@/lib/auth-server';

/**
 * Server-side session gate. Runs on every request, so a session
 * revoked by the admin (or by a second login) is caught immediately
 * — no stale cached client state. The proxy.ts HMAC/role check is
 * the first gate; this store check is the authoritative one.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? '';
  const email = token ? verifySession(token) : null;
  const user = email ? getUserByEmail(email) : null;

  if (!user || user.role !== 'admin') {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}


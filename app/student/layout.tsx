import { redirect } from 'next/navigation';
import { StudentTopbar } from '@/components/student/student-topbar';
import { StudentShell } from '@/components/student/student-shell';
import { getCurrentUser } from '@/lib/session';
import { AuthProvider } from '@/lib/auth-provider';

/**
 * Server-side session + role gate (Better Auth). Runs on every
 * request, so a revoked or banned session is caught immediately —
 * no stale cached client state. proxy.ts is the first (presence)
 * gate; this is the authoritative one.
 *
 * `getCurrentUser` is request-cached, so the page below can reuse the
 * same session without a second DB round-trip.
 *
 * `?denied=1` tells /login "you have a session but it is not allowed
 * here" — the login page skips its auto-redirect in that case, which
 * prevents an infinite /login <-> /student/dashboard bounce for
 * banned users or the wrong role.
 */
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentUser();
  if (!current) {
    redirect('/login');
  }
  if (current.role !== 'student' || current.banned) {
    redirect('/login?denied=1');
  }

  return (
    <AuthProvider
      // Already resolved on the server: no second session fetch, and no
      // "Sign in" flash before the real name paints.
      initialUser={{
        id: current.id,
        name: current.name,
        email: current.email,
        role: 'student',
      }}
    >
      <div className="flex min-h-screen flex-col">
        <StudentTopbar />
        <StudentShell>{children}</StudentShell>
      </div>
    </AuthProvider>
  );
}

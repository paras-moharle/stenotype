'use client';

import Link from 'next/link';
import { Activity, BookOpen, Library, Keyboard, LayoutDashboard, LogOut, User, Users } from 'lucide-react';
import { Logo } from '@/components/site/logo';
import { ThemeSwitch } from '@/components/ui/theme-switch';
import { useAuth } from '@/lib/use-auth';

const navigation = {
  student: [
    { href: '/student/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/student/typing', label: 'Typing', icon: Keyboard },
    { href: '/student/dictations', label: 'Dictations', icon: Library },
    { href: '/student/results', label: 'Results', icon: Activity },
    { href: '/student/profile', label: 'Profile', icon: User },
  ],
  admin: [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/students', label: 'Students', icon: Users },
    { href: '/admin/dictations', label: 'Dictations', icon: Library },
    { href: '/admin/results', label: 'Results', icon: Activity },
    { href: '/admin/login-history', label: 'Login history', icon: BookOpen },
  ],
};

export function WorkspaceShell({ children, role, pathname, contentClass }: {
  children: React.ReactNode; role: 'student' | 'admin'; pathname: string; contentClass: string;
}) {
  const { user, signOut } = useAuth();
  const links = navigation[role];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="flex min-h-16 items-center justify-between gap-2 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size="sm" />
            <span className="hidden border-l border-border pl-3 text-sm text-muted-foreground sm:inline">
              {role === 'admin' ? 'Administration' : 'Student workspace'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="hidden max-w-40 truncate px-2 text-sm text-muted-foreground sm:inline" title={user?.name}>{user?.name}</span>
            <ThemeSwitch />
            <button type="button" onClick={signOut} className="shell-nav-link size-11 justify-center p-0" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>
      <div className="md:grid md:min-h-[calc(100dvh-4rem)] md:grid-cols-[4.5rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={role === 'admin' ? 'Admin workspace' : 'Student workspace'}
          className="grid grid-cols-5 gap-1 border-b border-border bg-surface p-1.5 md:sticky md:top-16 md:flex md:h-[calc(100dvh-4rem)] md:flex-col md:self-start md:border-r md:border-b-0 md:p-2 xl:p-4">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} prefetch={false} title={label} aria-label={label}
              aria-current={pathname === href ? 'page' : undefined}
              className="shell-nav-link min-w-0 justify-center gap-1 px-1 py-2 text-center text-[.69rem] max-md:flex-col xl:justify-start xl:gap-3 xl:px-3 xl:text-left xl:text-sm">
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate md:hidden xl:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <main id="main-content" tabIndex={-1} className={contentClass}>{children}</main>
      </div>
    </div>
  );
}

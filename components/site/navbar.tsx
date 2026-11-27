'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/use-auth';
import { Logo } from '@/components/site/logo';
import { ThemeSwitch } from '@/components/ui/theme-switch';

export function Navbar() {
  const pathname = usePathname();
  const { user, isLoading, signOut } = useAuth();
  const workspace = user?.role === 'admin' ? '/admin' : '/student/dashboard';

  return (
    <header className="border-b border-border bg-surface">
      <nav aria-label="Main navigation" className="container-typing grid grid-cols-[1fr_auto] items-center gap-x-2 sm:min-h-16 sm:grid-cols-[1fr_auto_1fr]">
        <Logo size="sm" />
        <div className="order-last col-span-2 flex items-stretch gap-1 border-t border-border sm:order-0 sm:col-span-1 sm:border-0">
          <Link href="/" className="shell-nav-link min-h-11 justify-center max-sm:flex-1" aria-current={pathname === '/' ? 'page' : undefined}>Practice</Link>
          <Link href="/about" className="shell-nav-link min-h-11 justify-center max-sm:flex-1" aria-current={pathname === '/about' ? 'page' : undefined}>About</Link>
        </div>
        <div className="flex min-h-12 items-center justify-end gap-1">
          <ThemeSwitch />
          {isLoading ? <span aria-hidden className="h-11 w-[4.5rem] rounded-lg bg-muted" /> : user ? (
            <>
              <Link className="shell-nav-link max-[359px]:size-11 max-[359px]:justify-center max-[359px]:p-0" href={workspace} aria-label="Workspace">
                <LayoutDashboard className="hidden size-4 max-[359px]:block" aria-hidden />
                <span className="max-[359px]:sr-only">Workspace</span>
              </Link>
              <button type="button" className="shell-nav-link size-11 justify-center p-0" onClick={signOut} aria-label="Sign out">
                <LogOut className="size-4" aria-hidden />
              </button>
            </>
          ) : <Link href="/login" aria-current={pathname === '/login' ? 'page' : undefined} className="shell-nav-link min-h-11 bg-brand-soft px-3 text-brand">Sign in</Link>}
        </div>
      </nav>
    </header>
  );
}

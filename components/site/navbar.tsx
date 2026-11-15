'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/use-auth';

const navLinks = [
  { href: '/', label: 'Practice' },
  { href: '/about', label: 'About' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated, signOut } = useAuth();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <nav className="container-page relative flex h-14 items-center justify-between sm:h-16">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-[12px] font-bold leading-none text-brand-foreground shadow-sm"
            aria-hidden="true"
          >
            S
          </span>
          StenoType
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-2xl border border-border/70 bg-surface/70 p-1 shadow-sm md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={cn(
                'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive(link.href)
                  ? 'bg-brand/10 text-brand'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isAuthenticated && user?.role === 'admin' && (
            <Link
              href="/admin"
              className="hidden rounded-xl px-3 py-1.5 text-sm font-medium text-brand transition-colors hover:bg-brand/10 sm:inline-flex"
            >
              Admin
            </Link>
          )}

          {isAuthenticated && user?.role === 'student' && (
            <Link
              href="/student/dashboard"
              className="hidden rounded-xl px-3 py-1.5 text-sm font-medium text-brand transition-colors hover:bg-brand/10 sm:inline-flex"
            >
              Dashboard
            </Link>
          )}

          {isAuthenticated ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2 py-1.5 sm:px-3">
                <User
                  className="h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="hidden text-sm font-medium text-foreground sm:inline">
                  {user?.name?.split(' ')[0] ?? user?.email}
                </span>
                <span className="hidden font-mono text-[10px] uppercase tracking-wider text-brand sm:inline">
                  {user?.role}
                </span>
              </div>

              <button
                type="button"
                onClick={signOut}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex h-9 items-center rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Sign in
            </Link>
          )}

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 md:hidden"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={cn(
                  'rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(link.href)
                    ? 'bg-brand/10 text-brand'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}

            {isAuthenticated && user?.role === 'admin' && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-brand hover:bg-brand/10"
              >
                Admin
              </Link>
            )}

            {isAuthenticated && user?.role === 'student' && (
              <Link
                href="/student/dashboard"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-brand hover:bg-brand/10"
              >
                Dashboard
              </Link>
            )}

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  signOut();
                }}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out ({user?.role})
              </button>
            ) : (
              <Button asChild size="sm" className="mt-1 rounded-xl">
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  Sign in
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

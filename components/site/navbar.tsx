'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/use-auth';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/typing', label: 'Typing' },
  { href: '/classes', label: 'Classes' },
  { href: '/about', label: 'About' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated, signOut } = useAuth();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <nav className="container-page flex h-16 items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-brand text-[12px] font-bold leading-none text-brand-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.04)]"
            aria-hidden="true"
          >
            S
          </span>
          StenoType
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive(link.href)
                  ? 'text-brand'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated && user?.role === 'admin' && (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-brand transition-colors hover:text-brand/80"
            >
              Admin
            </Link>
          )}
          {isAuthenticated && user?.role === 'student' && (
            <Link
              href="/student/dashboard"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-brand transition-colors hover:text-brand/80"
            >
              Dashboard
            </Link>
          )}
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-sm font-medium text-foreground">
                  {user?.name?.split(' ')[0] ?? user?.email}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-brand">
                  {user?.role}
                </span>
              </div>
              <button
                onClick={signOut}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/mock-login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/typing">Start Practicing</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="container-page flex flex-col gap-1 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(link.href)
                    ? 'text-brand'
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
                className="rounded-md px-3 py-2.5 text-sm font-medium text-brand"
              >
                Admin
              </Link>
            )}
            {isAuthenticated && user?.role === 'student' && (
              <Link
                href="/student/dashboard"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-brand"
              >
                Dashboard
              </Link>
            )}
            {isAuthenticated ? (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  signOut();
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out ({user?.role})
              </button>
            ) : (
              <Button asChild size="sm" className="mt-2">
                <Link href="/mock-login" onClick={() => setMobileOpen(false)}>
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

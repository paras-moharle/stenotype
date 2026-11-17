'use client';

import Link from 'next/link';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/lib/use-auth';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/site/logo';

export function StudentTopbar() {
  const { user, isAuthenticated, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background sm:bg-background/80 sm:backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo size="sm" />
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-brand sm:inline">
            Student
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 sm:px-3">
                <User
                  className="h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="hidden max-w-[9rem] truncate text-sm font-medium text-foreground sm:inline">
                  {user?.name?.split(' ')[0] ?? user?.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                aria-label="Sign out"
                className="gap-1.5 px-2 text-muted-foreground sm:px-3"
              >
                <LogOut className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}


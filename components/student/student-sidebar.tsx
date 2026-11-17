'use client';

import Link from 'next/link';
import {
  LayoutDashboard,
  Headphones,
  PenLine,
  BarChart3,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/site/logo';

const studentLinks = [
  { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/student/dictations', label: 'Dictations', icon: Headphones },
  { href: '/student/typing', label: 'Typing', icon: PenLine },
  { href: '/student/results', label: 'Results', icon: BarChart3 },
  { href: '/student/profile', label: 'Profile', icon: User },
];

interface StudentSidebarProps {
  pathname: string;
}

export function StudentSidebar({ pathname }: StudentSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface/50 md:block">
      <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col">
        <div className="border-b border-border px-5 py-4">
          <Logo size="sm" />
          <p className="mt-2 text-[10px] font-medium uppercase tracking-widest text-brand">
            Student Panel
          </p>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
          {studentLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.exact
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-brand/15 text-brand shadow-sm'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground hover:translate-x-0.5'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}


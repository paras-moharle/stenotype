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
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface/50 md:block">
      <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col">
        <div className="border-b border-border px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-brand">
            Student
          </p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {studentLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.exact
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

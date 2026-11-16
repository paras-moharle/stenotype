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
  { href: '/student/dashboard', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/student/dictations', label: 'Dictation', icon: Headphones },
  { href: '/student/typing', label: 'Typing', icon: PenLine },
  { href: '/student/results', label: 'Results', icon: BarChart3 },
  { href: '/student/profile', label: 'Profile', icon: User },
];

interface StudentMobileNavProps {
  pathname: string;
}

/**
 * Bottom tab bar for small screens. The desktop sidebar is hidden below
 * `md`, so this is the only way to navigate on phones.
 */
export function StudentMobileNav({ pathname }: StudentMobileNavProps) {
  return (
    <nav
      aria-label="Student navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5">
        {studentLinks.map((link) => {
          const Icon = link.icon;
          const isActive = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(link.href + '/');

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-all',
                isActive ? 'text-brand' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.8} />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


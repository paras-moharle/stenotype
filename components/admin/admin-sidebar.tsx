'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Headphones,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/use-auth';
import { Logo } from '@/components/site/logo';

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/students', label: 'Students', icon: Users },
  { href: '/admin/dictations', label: 'Dictations', icon: Headphones },
  { href: '/admin/results', label: 'Results', icon: BarChart3 },
];

interface AdminSidebarProps {
  pathname: string;
}

export function AdminSidebar({ pathname }: AdminSidebarProps) {
  const { signOut } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface/50 md:block">
      <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col">
        <div className="border-b border-border px-5 py-4">
          <Logo size="sm" />
          <p className="mt-2 text-[10px] font-medium uppercase tracking-widest text-brand">
            Admin Panel
          </p>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.exact
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
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
        <div className="border-t border-border p-3">
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}


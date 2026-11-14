'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Headphones,
  BarChart3,
  IndianRupee,
  Calendar,
  Settings,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/use-auth';

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/students', label: 'Students', icon: Users },
  { href: '/admin/batches', label: 'Batches', icon: UsersRound },
  { href: '/admin/dictations', label: 'Dictations', icon: Headphones },
  { href: '/admin/results', label: 'Results', icon: BarChart3 },
  { href: '/admin/fees', label: 'Fees', icon: IndianRupee },
  { href: '/admin/schedule', label: 'Schedule', icon: Calendar },
  { href: '/admin/content', label: 'Content', icon: BookOpen },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

interface AdminSidebarProps {
  pathname: string;
}

export function AdminSidebar({ pathname }: AdminSidebarProps) {
  const { signOut } = useAuth();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface/50 md:block">
      <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col">
        <div className="border-b border-border px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-brand">
            Admin
          </p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
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
        <div className="border-t border-border p-3">
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

'use client';

import Link from 'next/link';
import { Menu, X, ExternalLink, LogOut } from 'lucide-react';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Headphones,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/use-auth';

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/students', label: 'Students', icon: Users },
  { href: '/admin/dictations', label: 'Dictations', icon: Headphones },
  { href: '/admin/results', label: 'Results', icon: BarChart3 },
];

interface AdminMobileNavProps {
  pathname: string;
}

export function AdminMobileNav({ pathname }: AdminMobileNavProps) {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();

  return (
    <div className="border-b border-border bg-surface/50 md:hidden">
      <div className="container-page flex items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-brand">
            Admin
          </p>
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="inline h-3 w-3" /> View site
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void signOut()}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent"
            aria-label="Toggle admin menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="container-page grid grid-cols-2 gap-1 pb-3">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            const isActive =
              link.href === '/admin'
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand/15 text-brand'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}


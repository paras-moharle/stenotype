import Link from 'next/link';
import { Github } from 'lucide-react';
import { Logo } from '@/components/site/logo';

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-typing flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5">
        <Logo size="sm" />
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-1">
          <Link href="/" className="shell-nav-link">Typing practice</Link>
          <Link href="/about" className="shell-nav-link">About</Link>
          <a className="shell-nav-link" href="https://github.com/paras-moharle" target="_blank" rel="noopener noreferrer">
            <Github className="size-4" aria-hidden /> GitHub
          </a>
        </nav>
        <p className="text-sm text-muted-foreground">Built by Paras Moharle.</p>
      </div>
    </footer>
  );
}

import Link from 'next/link';
import { Github } from 'lucide-react';

const footerLinks = [
  { href: '/', label: 'Typing practice' },
  { href: '/about', label: 'About' },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container-page flex flex-col items-center justify-between gap-6 py-10 sm:flex-row">
        <div className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-foreground">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-brand text-[10px] font-bold leading-none text-brand-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.04)]"
            aria-hidden="true"
          >
            S
          </span>
          StenoType
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <a
          href="https://github.com/paras-moharle"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Github className="h-4 w-4" strokeWidth={1.5} />
          paras-moharle
        </a>
      </div>
      <div className="border-t border-border">
        <div className="container-page py-4">
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} StenoType. Built by Paras Moharle.
          </p>
        </div>
      </div>
    </footer>
  );
}

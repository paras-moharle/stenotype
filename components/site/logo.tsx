import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const sizes = {
  sm: ['size-8', 'text-base'],
  md: ['size-9', 'text-lg'],
  lg: ['size-11', 'text-xl'],
};

export function Logo({ size = 'md', className, onClick }: LogoProps) {
  const [mark, wordmark] = sizes[size];
  return (
    <Link href="/" onClick={onClick} className={cn('inline-flex shrink-0 items-center gap-2.5 font-semibold tracking-[-.04em]', className)}>
      <span className={cn('grid place-items-center rounded-lg bg-brand text-brand-foreground', mark)} aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 6h8l-3 4h7l-5 7M6 19h5" />
        </svg>
      </span>
      <span className={wordmark}>StenoType</span>
    </Link>
  );
}

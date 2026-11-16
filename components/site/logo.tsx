import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export function Logo({ size = 'md', className, onClick }: LogoProps) {
  const sizes = {
    sm: { icon: 'h-8 w-8', text: 'text-base', gap: 'gap-2' },
    md: { icon: 'h-10 w-10', text: 'text-xl', gap: 'gap-2.5' },
    lg: { icon: 'h-12 w-12', text: 'text-2xl', gap: 'gap-3' },
  };

  const s = sizes[size];

  return (
    <Link
      href="/"
      onClick={onClick}
      className={cn(
        'group flex items-center font-bold tracking-tight text-foreground transition-all',
        s.gap,
        className
      )}
    >
      {/* Icon — keyboard keys design */}
      <span
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 transition-transform group-hover:scale-105',
          s.icon
        )}
        aria-hidden="true"
      >
        {/* Key dots */}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-[3px]">
          <span className="flex gap-[3px]">
            <span className="h-[5px] w-[5px] rounded-[2px] bg-black/20" />
            <span className="h-[5px] w-[5px] rounded-[2px] bg-black/20" />
            <span className="h-[5px] w-[5px] rounded-[2px] bg-black/20" />
          </span>
          <span className="flex gap-[3px]">
            <span className="h-[5px] w-[5px] rounded-[2px] bg-black/20" />
            <span className="h-[5px] w-[5px] rounded-[2px] bg-black/20" />
            <span className="h-[5px] w-[5px] rounded-[2px] bg-black/20" />
          </span>
          <span className="h-[5px] w-8 rounded-[2px] bg-black/20" />
        </span>
        {/* S letter overlay */}
        <span className="relative z-10 font-extrabold text-black/70 text-sm">S</span>
      </span>

      {/* Wordmark */}
      <span className={cn('font-extrabold tracking-tight', s.text)}>
        <span className="text-foreground">Steno</span>
        <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          Type
        </span>
      </span>
    </Link>
  );
}


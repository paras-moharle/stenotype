'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Ellipsis } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AdminRowActions({ label, disabled, children }: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const position = useCallback(() => {
    const button = trigger.current;
    const menu = panel.current;
    if (!button || !menu?.matches(':popover-open')) return;

    const gap = 6;
    const padding = 10;
    const visual = window.visualViewport;
    const left = visual?.offsetLeft ?? 0;
    const top = visual?.offsetTop ?? 0;
    const right = left + (visual?.width ?? window.innerWidth);
    const bottom = top + (visual?.height ?? window.innerHeight);
    const anchor = button.getBoundingClientRect();
    if (anchor.bottom <= top || anchor.top >= bottom || anchor.right <= left || anchor.left >= right) {
      menu.hidePopover();
      return;
    }

    menu.style.maxWidth = `${right - left - 2 * padding}px`;
    const width = menu.offsetWidth;
    const fullHeight = menu.scrollHeight + menu.offsetHeight - menu.clientHeight;
    const below = Math.max(0, bottom - padding - anchor.bottom - gap);
    const above = Math.max(0, anchor.top - top - padding - gap);
    const flip = fullHeight > below && above > below;
    menu.style.maxHeight = `${flip ? above : below}px`;
    menu.style.left = `${Math.max(left + padding, Math.min(anchor.right - width, right - padding - width))}px`;
    menu.style.top = `${flip ? Math.max(top + padding, anchor.top - gap - menu.offsetHeight) : anchor.bottom + gap}px`;
    menu.dataset.positioned = 'true';
  }, []);

  useEffect(() => {
    if (!open) return;
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [open, position]);

  return (
    <>
      <Button ref={trigger} variant="outline" size="icon" type="button" aria-label={label}
        popoverTarget={id} disabled={disabled}>
        <Ellipsis aria-hidden="true" size={18} />
      </Button>
      <div ref={panel} id={id} popover="auto" role="group" aria-label={label}
        className="admin-row-actions"
        onToggle={event => {
          const menu = event.currentTarget;
          const visible = menu.matches(':popover-open');
          if (visible) position();
          else delete menu.dataset.positioned;
          setOpen(visible);
        }}
        onClick={event => {
          if ((event.target as HTMLElement).closest('button, a')) panel.current?.hidePopover();
        }}>
        {children}
      </div>
    </>
  );
}

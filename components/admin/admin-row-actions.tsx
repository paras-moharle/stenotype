'use client';

import { useId, useRef, type ReactNode } from 'react';
import { Ellipsis } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AdminRowActions({ label, disabled, children }: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);

  return (
    <>
      <Button variant="outline" size="icon" type="button" aria-label={label}
        popoverTarget={id} disabled={disabled}>
        <Ellipsis aria-hidden="true" size={18} />
      </Button>
      <div ref={panel} id={id} popover="auto" role="group" aria-label={label}
        className="admin-row-actions" onClick={event => {
          if ((event.target as HTMLElement).closest('button, a')) panel.current?.hidePopover();
        }}>
        {children}
      </div>
    </>
  );
}

'use client';

import { useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export function Modal({ title, labelledBy, onClose, className, children }: {
  title?: string; labelledBy?: string; onClose: () => void; className?: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog ref={ref} className={cn('app-dialog max-w-lg', className)}
      aria-label={title} aria-labelledby={labelledBy}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      {children}
    </dialog>
  );
}

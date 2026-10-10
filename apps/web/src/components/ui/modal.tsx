import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md';
}

export function Modal({ open, title, onClose, children, footer, width = 'sm' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 p-4 backdrop-blur-[2px] sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'bg-surface border-border-default mt-10 flex w-full flex-col rounded-xl border shadow-pop',
          width === 'sm' ? 'max-w-md' : 'max-w-2xl',
        )}
      >
        <header className="border-border-subtle flex items-center justify-between border-b px-5 py-3.5">
          <h2 className="text-ink-900 text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-500 hover:bg-surface-sunken hover:text-ink-900 rounded-md p-1"
            aria-label="Fermer"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="border-border-subtle bg-surface-muted flex justify-end gap-2 rounded-b-xl border-t px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

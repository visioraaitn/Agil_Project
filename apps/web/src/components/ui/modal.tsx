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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'bg-surface border-border-default mt-12 flex w-full flex-col rounded border shadow-lg',
          width === 'sm' ? 'max-w-md' : 'max-w-2xl',
        )}
      >
        <header className="border-border-subtle flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-ink-900 text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-500 hover:bg-surface-sunken rounded p-1"
            aria-label="Fermer"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-3 py-3">{children}</div>
        {footer && (
          <footer className="border-border-subtle flex justify-end gap-2 border-t px-3 py-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

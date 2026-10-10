import { forwardRef } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const BASE =
  'w-full rounded-lg border bg-surface px-2.5 py-1.5 text-base text-ink-900 placeholder:text-ink-400 transition-colors ' +
  'focus:border-accent-500 focus:ring-3 focus:ring-accent-500/15 focus:outline-none disabled:bg-surface-sunken disabled:text-ink-400';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(BASE, invalid ? 'border-danger' : 'border-border-default', className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        BASE,
        'min-h-16 resize-y',
        invalid ? 'border-danger' : 'border-border-default',
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className, invalid, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        BASE,
        'h-8 py-0',
        invalid ? 'border-danger' : 'border-border-default',
        className,
      )}
      {...props}
    />
  );
});

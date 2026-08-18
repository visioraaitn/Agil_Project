import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-500 text-white hover:bg-accent-600 disabled:bg-accent-300',
  secondary:
    'border border-border-strong bg-surface text-ink-700 hover:bg-surface-sunken disabled:text-ink-400',
  ghost: 'text-ink-700 hover:bg-surface-sunken disabled:text-ink-400',
  danger: 'bg-danger text-white hover:brightness-110 disabled:opacity-50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-6 px-2 text-sm gap-1',
  md: 'h-7.5 px-3 text-base gap-1.5',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded font-semibold transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  );
}

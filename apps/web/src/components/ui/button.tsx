import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent-500 text-white shadow-raised hover:bg-accent-600 disabled:bg-accent-300 disabled:shadow-none',
  secondary:
    'border border-border-default bg-surface text-ink-700 shadow-card hover:bg-surface-sunken hover:border-border-strong disabled:text-ink-400',
  ghost: 'text-ink-700 hover:bg-surface-sunken disabled:text-ink-400',
  danger: 'bg-danger text-white shadow-raised hover:brightness-110 disabled:opacity-50',
  'danger-outline':
    'border border-red-200 bg-surface text-danger shadow-card hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:hover:bg-red-950/40',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-sm gap-1.5 rounded-md',
  md: 'h-8.5 px-3.5 text-base gap-2 rounded-lg',
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
        'inline-flex shrink-0 items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0',
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

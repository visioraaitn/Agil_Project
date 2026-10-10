import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'purple';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-600',
  accent: 'bg-accent-50 text-accent-700',
  success: 'bg-green-50 text-success dark:bg-green-950/50',
  warning: 'bg-orange-50 text-warning dark:bg-orange-950/40',
  danger: 'bg-red-50 text-danger dark:bg-red-950/40',
  purple: 'bg-purple-50 text-purple dark:bg-purple-950/40 dark:text-purple-300',
};

const DOTS: Record<BadgeTone, string> = {
  neutral: 'bg-status-todo',
  accent: 'bg-accent-500',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  purple: 'bg-purple',
};

/** Pastille arrondie ; `dot` ajoute la puce de couleur des statuts. */
export function Badge({
  tone = 'neutral',
  dot = false,
  children,
  className,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 shrink-0 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  );
}

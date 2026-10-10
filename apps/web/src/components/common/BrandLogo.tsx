import { cn } from '@/lib/utils';

/** Pictogramme visioPlanner : trois colonnes de board sur tuile bleue. */
export function BrandMark({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg',
        inverted ? 'text-accent-500 bg-white' : 'bg-accent-500 text-white shadow-raised',
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="size-[55%]" fill="currentColor">
        <rect x="2.5" y="3" width="2.2" height="7.5" rx="1.1" />
        <rect x="6.9" y="3" width="2.2" height="10" rx="1.1" />
        <rect x="11.3" y="3" width="2.2" height="5" rx="1.1" />
      </svg>
    </span>
  );
}

/** Logo complet : pictogramme + « visioPlanner ». */
export function BrandLogo({
  className,
  inverted = false,
  hideText = false,
}: {
  className?: string;
  inverted?: boolean;
  hideText?: boolean;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark inverted={inverted} />
      {!hideText && (
        <span
          className={cn(
            'text-[17px] font-bold tracking-tight',
            inverted ? 'text-white' : 'text-ink-900',
          )}
        >
          visio<span className={inverted ? 'text-white/85' : 'text-accent-500'}>Planner</span>
        </span>
      )}
    </span>
  );
}

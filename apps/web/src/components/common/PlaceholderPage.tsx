import { Construction } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaceholderPageProps {
  title: string;
  /** Phase de livraison prévue, ex. « Phase 2 ». */
  phase: string;
  /** Référence du cahier des charges, ex. « C.1 · C.2 ». */
  reference?: string;
  description?: string;
  /** Page hors coquille applicative (écran de connexion). */
  standalone?: boolean;
}

/** Écran temporaire du scaffolding — remplacé module par module. */
export function PlaceholderPage({
  title,
  phase,
  reference,
  description,
  standalone = false,
}: PlaceholderPageProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 text-center',
        standalone ? 'min-h-screen bg-surface-muted' : 'h-full py-20',
      )}
    >
      <div className="bg-accent-50 text-accent-600 flex size-10 items-center justify-center rounded">
        <Construction className="size-5" strokeWidth={1.75} />
      </div>
      <h1 className="text-ink-900 text-xl font-semibold">{title}</h1>
      {description && <p className="text-ink-500 max-w-md text-base">{description}</p>}
      <div className="text-ink-400 flex items-center gap-2 text-sm">
        <span className="border-border-default rounded border px-1.5 py-0.5">{phase}</span>
        {reference && (
          <span className="border-border-default rounded border px-1.5 py-0.5">
            Cahier des charges {reference}
          </span>
        )}
      </div>
    </div>
  );
}

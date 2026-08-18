import type { ReactNode } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { Spinner } from '@/components/ui/spinner';

export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="text-ink-400 flex items-center justify-center gap-2 py-16 text-base">
      <Spinner />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Inbox className="text-ink-400 size-6" strokeWidth={1.5} />
      <p className="text-ink-700 text-lg font-semibold">{title}</p>
      {description && <p className="text-ink-500 max-w-md text-base">{description}</p>}
      {action}
    </div>
  );
}

/** Affiche le message métier renvoyé par l'API plutôt qu'une erreur générique. */
export function ErrorState({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue';

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <AlertCircle className="text-danger size-6" strokeWidth={1.5} />
      <p className="text-ink-700 text-lg font-semibold">{message}</p>
      {error instanceof ApiError && (
        <p className="text-ink-400 text-sm">
          Code {error.code} · HTTP {error.status}
        </p>
      )}
    </div>
  );
}

/** Bandeau d'erreur compact, pour les formulaires. */
export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof ApiError ? error.message : 'Une erreur est survenue';
  return (
    <p role="alert" className="bg-red-50 text-danger rounded px-2 py-1.5 text-base">
      {message}
    </p>
  );
}

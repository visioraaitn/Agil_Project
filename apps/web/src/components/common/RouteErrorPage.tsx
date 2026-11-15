import { AlertTriangle, ArrowLeft, RotateCw } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** Friendly fallback for route/render failures. Internal error details stay out of the UI. */
export function RouteErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const notFound = status === 404;

  return (
    <main className="bg-canvas flex min-h-screen items-center justify-center p-6">
      <section
        aria-labelledby="route-error-title"
        className="border-border-default bg-surface w-full max-w-xl rounded-2xl border p-8 shadow-card sm:p-10"
      >
        <div className="bg-danger/10 text-danger mb-5 flex size-12 items-center justify-center rounded-xl">
          <AlertTriangle aria-hidden="true" className="size-6" />
        </div>
        <p className="text-accent-600 text-xs font-bold tracking-[0.16em] uppercase">
          visioPlanner
        </p>
        <h1 id="route-error-title" className="text-ink-900 mt-2 text-2xl font-bold">
          {notFound ? 'Page introuvable' : 'Cette page a rencontré un problème'}
        </h1>
        <p role="alert" className="text-ink-500 mt-3 max-w-lg text-sm leading-6">
          {notFound
            ? 'Cette adresse ne correspond à aucune page disponible.'
            : 'La page n’a pas pu être affichée. Rechargez-la ou revenez au tableau de bord. Si une action était en cours, vérifiez son état avant de la relancer.'}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => window.location.reload()}>
            <RotateCw aria-hidden="true" />
            Recharger la page
          </Button>
          <a
            href="/portfolio"
            className="text-ink-600 hover:bg-surface-sunken inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Retour au tableau de bord
          </a>
        </div>

        <p className="text-ink-400 mt-6 text-xs">
          {notFound
            ? 'Vérifiez l’adresse ou revenez à vos projets.'
            : 'Si le problème revient, contactez le support.'}
        </p>
      </section>
    </main>
  );
}

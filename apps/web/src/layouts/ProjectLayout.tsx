import { Outlet, useParams } from 'react-router-dom';

/**
 * Contexte projet : sert de point d'accroche au chargement du projet courant et
 * de ses permissions (phase 1), puis au fil d'Ariane et aux filtres partagés.
 */
export function ProjectLayout() {
  const { projectKey } = useParams<{ projectKey: string }>();

  return (
    <div className="flex h-full flex-col">
      <div className="border-border-subtle text-ink-400 shrink-0 border-b px-4 py-1.5 text-sm">
        Projet <span className="text-ink-700 font-semibold">{projectKey}</span>
      </div>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

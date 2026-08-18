import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { ProjectStatus, type ProjectSummary } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateMessage';
import { RoleBadge } from '@/components/common/RoleBadge';
import { useAuth } from '@/features/auth/use-auth';
import { CreateProjectDialog } from '@/features/projects/components/CreateProjectDialog';
import { useProjects } from '@/features/projects/hooks';

const STATUS_TONE = {
  [ProjectStatus.ACTIVE]: 'success',
  [ProjectStatus.ON_HOLD]: 'warning',
  [ProjectStatus.COMPLETED]: 'accent',
  [ProjectStatus.ARCHIVED]: 'neutral',
} as const;

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: 'Actif',
  ON_HOLD: 'En pause',
  COMPLETED: 'Terminé',
  ARCHIVED: 'Archivé',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** B.2 · Vue portefeuille : tous les projets sur un tableau unique. */
export function PortfolioPage() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, error } = useProjects({
    search: search.trim() || undefined,
    pageSize: 100,
  });

  return (
    <div className="flex h-full flex-col">
      <header className="border-border-subtle flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <h1 className="text-ink-900 text-xl font-semibold">Portefeuille</h1>
        {data && <span className="text-ink-400 text-sm">{data.total} projet(s)</span>}

        <div className="ml-auto flex items-center gap-2">
          <div className="border-border-strong bg-surface focus-within:border-accent-500 flex h-7 w-56 items-center gap-1.5 rounded border px-2">
            <Search className="text-ink-400 size-3.5 shrink-0" strokeWidth={2} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrer les projets…"
              aria-label="Filtrer les projets"
              className="text-ink-700 placeholder:text-ink-400 w-full bg-transparent text-base outline-none"
            />
          </div>
          {isAdmin && (
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3.5" strokeWidth={2.5} />
              Nouveau projet
            </Button>
          )}
        </div>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        {isLoading && <LoadingState />}
        {error && <ErrorState error={error} />}

        {data && data.items.length === 0 && (
          <EmptyState
            title="Aucun projet"
            description={
              isAdmin
                ? 'Créez un premier projet pour démarrer.'
                : "Vous n'êtes membre d'aucun projet. Demandez à un administrateur de vous affecter."
            }
            action={
              isAdmin ? (
                <Button variant="primary" onClick={() => setDialogOpen(true)}>
                  Créer un projet
                </Button>
              ) : undefined
            }
          />
        )}

        {data && data.items.length > 0 && <ProjectTable projects={data.items} />}
      </div>

      <CreateProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

function ProjectTable({ projects }: { projects: ProjectSummary[] }) {
  return (
    <table className="w-full border-collapse text-base">
      <thead className="bg-surface-muted text-ink-500 sticky top-0 text-left text-sm">
        <tr className="border-border-default border-b">
          <th className="px-4 py-1.5 font-semibold">Projet</th>
          <th className="px-3 py-1.5 font-semibold">Entreprise</th>
          <th className="px-3 py-1.5 font-semibold">Statut</th>
          <th className="px-3 py-1.5 font-semibold">Mon rôle</th>
          <th className="px-3 py-1.5 font-semibold">Membres</th>
          <th className="px-3 py-1.5 font-semibold">Début</th>
          <th className="px-3 py-1.5 font-semibold">Échéance</th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr key={project.id} className="border-border-subtle hover:bg-surface-muted border-b">
            <td className="px-4 py-1.5">
              <Link
                to={`/projects/${project.key}/overview`}
                className="flex items-center gap-2 font-semibold"
              >
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
                  style={{ backgroundColor: project.color ?? '#0078D4' }}
                >
                  {project.key.slice(0, 2)}
                </span>
                <span className="text-accent-700 hover:underline">{project.name}</span>
                <span className="text-ink-400 font-normal">{project.key}</span>
              </Link>
            </td>
            <td className="text-ink-500 px-3 py-1.5">{project.company ?? '—'}</td>
            <td className="px-3 py-1.5">
              <Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
            </td>
            <td className="px-3 py-1.5">
              {project.currentUserRole ? (
                <RoleBadge role={project.currentUserRole} />
              ) : (
                <span className="text-ink-400 text-sm">non membre</span>
              )}
            </td>
            <td className="text-ink-500 px-3 py-1.5">{project.memberCount}</td>
            <td className="text-ink-500 px-3 py-1.5">{formatDate(project.startDate)}</td>
            <td className="text-ink-500 px-3 py-1.5">{formatDate(project.targetDate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListFilter, Plus, Search } from 'lucide-react';
import { ProjectStatus, type ProjectSummary } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateMessage';
import { PageHeader } from '@/components/common/PageHeader';
import { ProjectTile } from '@/components/common/ProjectTile';
import { RoleBadge } from '@/components/common/RoleBadge';
import { useAuth } from '@/features/auth/use-auth';
import { cn } from '@/lib/utils';
import { CreateProjectDialog } from '@/features/projects/components/CreateProjectDialog';
import { useProjects } from '@/features/projects/hooks';

const STATUS_TONE = {
  [ProjectStatus.ACTIVE]: 'success',
  [ProjectStatus.ON_HOLD]: 'warning',
  [ProjectStatus.COMPLETED]: 'accent',
  [ProjectStatus.ARCHIVED]: 'neutral',
} as const;

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: 'En cours',
  ON_HOLD: 'En pause',
  COMPLETED: 'Terminé',
  ARCHIVED: 'Archivé',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** B.2 · Vue portefeuille : tous les projets sur un tableau unique. */
export function PortfolioPage() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [sortBy, setSortBy] = useState<
    'name' | 'company' | 'status' | 'memberCount' | 'startDate' | 'targetDate'
  >('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, error } = useProjects({
    search: search.trim() || undefined,
    status: status || undefined,
    pageSize: 100,
  });

  const sortedProjects = useMemo(() => {
    const projects = [...(data?.items ?? [])];
    const direction = sortOrder === 'asc' ? 1 : -1;
    return projects.sort((left, right) => {
      const leftValue = sortBy === 'status' ? left.effectiveStatus : (left[sortBy] ?? '');
      const rightValue = sortBy === 'status' ? right.effectiveStatus : (right[sortBy] ?? '');
      return (
        String(leftValue).localeCompare(String(rightValue), 'fr', { numeric: true }) * direction
      );
    });
  }, [data?.items, sortBy, sortOrder]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 px-4 pt-5 pb-4 sm:px-6">
        <PageHeader
          title="Portefeuille"
          breadcrumbs={[{ label: 'visioPlanner' }, { label: 'Portefeuille' }]}
          count={data ? `${data.total} projet${data.total > 1 ? 's' : ''}` : undefined}
          actions={
            isAdmin && (
              <Button variant="primary" onClick={() => setDialogOpen(true)}>
                <Plus strokeWidth={2.5} />
                Nouveau projet
              </Button>
            )
          }
        />

        <div className="card flex flex-wrap items-center gap-2 p-2.5">
          <div className="relative w-full sm:w-64">
            <Search
              className="text-ink-400 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              strokeWidth={2}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrer les projets…"
              aria-label="Filtrer les projets"
              className="search-field"
            />
          </div>
          <span className="bg-border-default mx-0.5 hidden h-6 w-px sm:block" aria-hidden="true" />
          <select
            aria-label="Filtrer les projets par statut"
            className={cn('filter-select', status && 'is-active')}
            value={status}
            onChange={(event) => setStatus(event.target.value as ProjectStatus | '')}
          >
            <option value="">Tous statuts</option>
            {Object.values(ProjectStatus).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <ListFilter
                className="text-ink-500 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                strokeWidth={2}
              />
              <select
                aria-label="Trier les projets"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="bg-surface-sunken text-ink-700 hover:bg-border-subtle focus:border-accent-500 h-8 cursor-pointer appearance-none rounded-lg border border-transparent pr-3 pl-7.5 text-sm font-medium focus:outline-none"
              >
                <option value="name">Nom</option>
                <option value="company">Entreprise</option>
                <option value="status">Statut</option>
                <option value="memberCount">Membres</option>
                <option value="startDate">Début</option>
                <option value="targetDate">Échéance</option>
              </select>
            </div>
            <select
              aria-label="Sens du tri"
              className="filter-select"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)}
            >
              <option value="asc">Croissant</option>
              <option value="desc">Décroissant</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 sm:px-6">
        <div className="card scrollbar-thin max-h-full min-h-0 overflow-auto">
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

          {data && data.items.length > 0 && <ProjectTable projects={sortedProjects} />}
        </div>
      </div>

      <CreateProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

function ProjectTable({ projects }: { projects: ProjectSummary[] }) {
  return (
    <table className="w-full min-w-[900px] border-collapse text-base">
      <thead className="bg-surface-muted text-ink-500 sticky top-0 z-10 text-left text-[11px] tracking-wider uppercase">
        <tr className="border-border-default border-b">
          <th className="px-5 py-3 font-semibold">Projet</th>
          <th className="px-3 py-3 font-semibold">Entreprise</th>
          <th className="px-3 py-3 font-semibold">Statut</th>
          <th className="px-3 py-3 font-semibold">Mon rôle</th>
          <th className="px-3 py-3 text-right font-semibold">Membres</th>
          <th className="px-3 py-3 font-semibold">Début</th>
          <th className="px-5 py-3 font-semibold">Échéance</th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr
            key={project.id}
            className="border-border-subtle hover:bg-surface-muted border-b last:border-b-0"
          >
            <td className="px-5 py-3">
              <Link
                to={`/projects/${project.key}/overview`}
                className="group flex items-center gap-3"
              >
                <ProjectTile project={project} />
                <span className="min-w-0">
                  <span className="text-ink-900 group-hover:text-accent-700 block truncate font-semibold">
                    {project.name}
                  </span>
                  <span className="text-ink-500 block font-mono text-[11px]">{project.key}</span>
                </span>
              </Link>
            </td>
            <td className="text-ink-700 px-3 py-3">{project.company ?? '—'}</td>
            <td className="px-3 py-3">
              <Badge tone={STATUS_TONE[project.effectiveStatus]} dot>
                {project.effectiveStatus === ProjectStatus.ACTIVE && project.activeSprint
                  ? `En cours · ${project.activeSprint.name}`
                  : STATUS_LABEL[project.effectiveStatus]}
              </Badge>
            </td>
            <td className="px-3 py-3">
              {project.currentUserRole ? (
                <RoleBadge role={project.currentUserRole} />
              ) : (
                <span className="text-ink-500 text-sm">non membre</span>
              )}
            </td>
            <td className="text-ink-900 px-3 py-3 text-right font-semibold tabular-nums">
              {project.memberCount}
            </td>
            <td className="text-ink-700 px-3 py-3">{formatDate(project.startDate)}</td>
            <td className="text-ink-700 px-5 py-3">{formatDate(project.targetDate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Clock, Pencil, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { LABELS_FR, ProjectStatus } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/common/StateMessage';
import { ProjectTile } from '@/components/common/ProjectTile';
import { BoardStatsPanel } from '../components/BoardStatsPanel';
import { MembersPanel } from '../components/MembersPanel';
import { ProjectDeadlineDialog } from '../components/ProjectDeadlineDialog';
import { ProjectDocumentsPanel } from '../components/ProjectDocumentsPanel';
import { EditProjectDialog } from '../components/EditProjectDialog';
import { DeleteProjectDialog } from '../components/DeleteProjectDialog';
import { useProject, useProjectPermissions } from '../hooks';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: 'En cours',
  ON_HOLD: 'En pause',
  COMPLETED: 'Terminé',
  ARCHIVED: 'Archivé',
};

const STATUS_TONE = {
  [ProjectStatus.ACTIVE]: 'success',
  [ProjectStatus.ON_HOLD]: 'warning',
  [ProjectStatus.COMPLETED]: 'accent',
  [ProjectStatus.ARCHIVED]: 'neutral',
} as const;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/** B.1 · Détails du projet et affectation des utilisateurs. */
export function ProjectOverviewPage() {
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();
  const { projectKey } = useParams<{ projectKey: string }>();
  const { data: project, isLoading, error } = useProject(projectKey);
  const { can, role } = useProjectPermissions(projectKey);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!project || !projectKey) return null;

  return (
    <div className="scrollbar-thin h-full overflow-auto">
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6 sm:px-6">
        <header className="card flex flex-wrap items-center gap-4 p-5">
          <ProjectTile project={project} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-ink-900 truncate text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
            <div className="text-ink-600 mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              <span className="bg-surface-sunken text-ink-700 rounded-md px-1.5 py-0.5 font-mono text-xs">
                {project.key}
              </span>
              {project.company && <span>{project.company}</span>}
              <span className="bg-border-strong size-1 rounded-full" aria-hidden="true" />
              <Badge tone={STATUS_TONE[project.effectiveStatus]} dot>
                {project.effectiveStatus === ProjectStatus.ACTIVE && project.activeSprint
                  ? `En cours · ${project.activeSprint.name}`
                  : STATUS_LABEL[project.effectiveStatus]}
              </Badge>
              {role && <Badge tone="accent">Mon rôle : {LABELS_FR.projectRole[role]}</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {can('project:update') && (
              <Button onClick={() => setEditOpen(true)}>
                <Pencil strokeWidth={1.75} />
                Modifier
              </Button>
            )}
            {can('project:delete') && (
              <Button variant="danger-outline" onClick={() => setDeleteOpen(true)}>
                <Trash2 strokeWidth={1.75} />
                Supprimer
              </Button>
            )}
          </div>
        </header>

        <BoardStatsPanel projectKey={projectKey} />

        <div className="grid gap-4 lg:grid-cols-[1fr_370px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Stat label="Entreprise" value={project.company ?? '—'} />
              <Stat label="Membres" value={project.memberCount} />
              <Stat label="Date de début" value={formatDate(project.startDate)} />
              <Stat
                label="Échéance"
                value={formatDate(project.targetDate)}
                action={
                  can('project:update') && (
                    <button
                      type="button"
                      aria-label="Modifier l’échéance"
                      onClick={() => setDeadlineOpen(true)}
                      className="text-accent-600 hover:bg-accent-50 -mt-1 -mr-1.5 rounded-md p-1.5"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.75} />
                    </button>
                  )
                }
              />
            </div>

            <section className="card px-5 py-4">
              <h2 className="text-ink-900 text-lg font-semibold">Description</h2>
              <p className="text-ink-700 mt-2 text-base whitespace-pre-line">
                {project.description ?? 'Aucune description.'}
              </p>
            </section>

            <ProjectDocumentsPanel
              projectRef={projectKey}
              canManage={can('project:document:manage')}
            />

            <section className="card px-5 py-4">
              <h2 className="text-ink-900 text-lg font-semibold">Activité récente</h2>
              <div className="bg-surface-muted text-ink-600 mt-3 flex items-center gap-3 rounded-lg px-4 py-3.5 text-base">
                <span className="bg-surface-sunken text-ink-500 flex size-8 items-center justify-center rounded-lg">
                  <Clock className="size-4" strokeWidth={1.75} />
                </span>
                L'historique des modifications arrive en phase 5.
              </div>
            </section>
          </div>

          <div>
            <MembersPanel projectRef={projectKey} canManage={can('project:member:manage')} />
          </div>
        </div>
      </div>

      <ProjectDeadlineDialog
        projectRef={projectKey}
        currentTargetDate={project.targetDate}
        open={deadlineOpen}
        onClose={() => setDeadlineOpen(false)}
      />
      <EditProjectDialog
        project={project}
        projectRef={projectKey}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      <DeleteProjectDialog
        projectRef={projectKey}
        projectName={project.name}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate('/portfolio', { replace: true })}
      />
    </div>
  );
}

function Stat({ label, value, action }: { label: string; value: ReactNode; action?: ReactNode }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-ink-500 text-sm font-medium">{label}</p>
        {action}
      </div>
      <p className="text-ink-900 mt-1.5 text-xl leading-snug font-bold">{value}</p>
    </div>
  );
}

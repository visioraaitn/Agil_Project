import { useState } from 'react';
import { Pencil, Settings, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { LABELS_FR, ProjectStatus } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/common/StateMessage';
import { MembersPanel } from '../components/MembersPanel';
import { ProjectDeadlineDialog } from '../components/ProjectDeadlineDialog';
import { ProjectDocumentsPanel } from '../components/ProjectDocumentsPanel';
import { EditProjectDialog } from '../components/EditProjectDialog';
import { DeleteProjectDialog } from '../components/DeleteProjectDialog';
import { useProject, useProjectPermissions } from '../hooks';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: 'Actif',
  ON_HOLD: 'En pause',
  COMPLETED: 'Terminé',
  ARCHIVED: 'Archivé',
};

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
      <header className="border-border-subtle flex items-center gap-3 border-b px-4 py-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded text-sm font-bold text-white"
          style={{ backgroundColor: project.color ?? '#0078D4' }}
        >
          {project.key.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <h1 className="text-ink-900 truncate text-xl font-semibold">{project.name}</h1>
          <p className="text-ink-400 text-sm">
            {project.key}
            {project.company && ` · ${project.company}`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge tone={project.status === ProjectStatus.ACTIVE ? 'success' : 'neutral'}>
            {STATUS_LABEL[project.status]}
          </Badge>
          {role && <Badge tone="accent">Mon rôle : {LABELS_FR.projectRole[role]}</Badge>}
          {can('project:update') && (
            <Button size="sm" onClick={() => setEditOpen(true)}>
              <Settings className="size-3.5" strokeWidth={1.75} />
              Modifier
            </Button>
          )}
          {can('project:delete') && (
            <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              Supprimer
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <section className="border-border-default bg-surface rounded border">
            <header className="border-border-subtle border-b px-3 py-2">
              <h2 className="text-ink-900 text-lg font-semibold">Informations</h2>
            </header>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-3 text-base">
              <div>
                <dt className="text-ink-400 text-sm">Entreprise</dt>
                <dd className="text-ink-900">{project.company ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-400 text-sm">Membres</dt>
                <dd className="text-ink-900">{project.memberCount}</dd>
              </div>
              <div>
                <dt className="text-ink-400 text-sm">Date de début</dt>
                <dd className="text-ink-900">{formatDate(project.startDate)}</dd>
              </div>
              <div>
                <dt className="text-ink-400 text-sm">Échéance</dt>
                <dd className="text-ink-900 flex items-center gap-1">
                  {formatDate(project.targetDate)}
                  {can('project:update') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Modifier l’échéance"
                      onClick={() => setDeadlineOpen(true)}
                    >
                      <Pencil className="size-3.5" strokeWidth={1.75} />
                    </Button>
                  )}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-ink-400 text-sm">Description</dt>
                <dd className="text-ink-700 whitespace-pre-line">
                  {project.description ?? 'Aucune description.'}
                </dd>
              </div>
            </dl>
          </section>

          <ProjectDocumentsPanel
            projectRef={projectKey}
            canManage={can('project:document:manage')}
          />

          <section className="border-border-default bg-surface rounded border">
            <header className="border-border-subtle border-b px-3 py-2">
              <h2 className="text-ink-900 text-lg font-semibold">Activité récente</h2>
            </header>
            <p className="text-ink-400 px-3 py-6 text-center text-base">
              L'historique des modifications arrive en phase 5.
            </p>
          </section>
        </div>

        <MembersPanel projectRef={projectKey} canManage={can('project:member:manage')} />
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

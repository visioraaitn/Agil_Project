import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Flag,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  Target,
  UserPlus,
  XCircle,
} from 'lucide-react';
import type {
  BacklogNode,
  RetrospectiveItemInput,
  SprintDetail,
  SprintPropagationConflict,
} from '@visiora/shared';
import {
  LABELS_FR,
  RetroCategory,
  SprintStatus as SprintStatusEnum,
  WorkItemType,
} from '@visiora/shared';
import {
  EmptyState,
  ErrorState,
  InlineError,
  LoadingState,
} from '@/components/common/StateMessage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useProjectPermissions } from '@/features/projects/hooks';
import { ApiError } from '@/lib/api-client';
import { CreateWorkItemDialog } from '@/features/work-items/components/CreateWorkItemDialog';
import { SprintConflictDialog } from '@/features/work-items/components/SprintConflictDialog';
import {
  StatusPill,
  StoryPoints,
  TicketKey,
  TypeIcon,
} from '@/features/work-items/components/WorkItemChrome';
import { cn } from '@/lib/utils';
import { useBacklog, useUpdateWorkItem } from '@/features/work-items/hooks';
import { CloseSprintDialog } from '../components/CloseSprintDialog';
import { SprintReportDialog } from '../components/SprintReportDialog';
import { SprintFormDialog } from '../components/SprintFormDialog';
import { SprintStatusBadge } from '../components/SprintStatusBadge';
import { formatSprintDate as formatDate } from '../format';
import {
  defaultSprintId,
  useSprint,
  useSprints,
  useUpdateRetrospective,
  useUpdateSprint,
} from '../hooks';

export function SprintsPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { data: sprints, isLoading, error } = useSprints(projectKey);
  const { data: selected, isLoading: detailLoading } = useSprint(projectKey, selectedId);
  const { can } = useProjectPermissions(projectKey);
  const updateSprint = useUpdateSprint(projectKey);

  useEffect(() => {
    if (selectedId) return;
    const fallback = defaultSprintId(sprints);
    if (fallback) setSelectedId(fallback);
  }, [selectedId, sprints]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[300px_1fr]">
      <aside className="flex min-h-0 flex-col gap-3 px-4 pt-5 pb-4 sm:pl-6 md:pr-0 md:pb-6">
        <header className="flex items-center gap-2">
          <h1 className="text-ink-900 text-xl font-bold tracking-tight">Sprints</h1>
          {can('sprint:manage') && (
            <Button
              variant="primary"
              size="sm"
              className="ml-auto"
              onClick={() => setCreateOpen(true)}
            >
              <Plus strokeWidth={2.5} />
              Nouveau
            </Button>
          )}
        </header>

        <div className="scrollbar-thin -m-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-1">
          {(sprints ?? []).length === 0 ? (
            <div className="card">
              <EmptyState title="Aucun sprint" description="Créez le premier sprint du projet." />
            </div>
          ) : (
            sprints?.map((sprint) => {
              const isSelected = sprint.id === selectedId;
              const isCompleted = sprint.status === SprintStatusEnum.COMPLETED;
              return (
                <button
                  key={sprint.id}
                  type="button"
                  onClick={() => setSelectedId(sprint.id)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'card flex w-full flex-col gap-2 px-3.5 py-3 text-left transition-colors',
                    isSelected
                      ? 'border-accent-400 ring-accent-500/15 ring-3'
                      : 'hover:border-border-strong',
                  )}
                >
                  <span className="flex items-start gap-2">
                    <span className="text-ink-900 min-w-0 flex-1 text-base leading-snug font-semibold">
                      {sprint.name}
                    </span>
                    <SprintStatusBadge status={sprint.status} />
                  </span>
                  <span className="text-ink-500 text-xs">
                    {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                  </span>
                  <ProgressBar
                    done={isCompleted ? 1 : sprint.liveCompletedPoints}
                    total={isCompleted ? 1 : sprint.liveCommittedPoints}
                    tone={isCompleted ? 'success' : 'accent'}
                  />
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="scrollbar-thin min-h-0 overflow-y-auto">
        {detailLoading ? (
          <LoadingState />
        ) : !selected ? (
          <EmptyState title="Planification vide" />
        ) : (
          <SprintDetailView
            sprint={selected}
            canClose={can('sprint:close')}
            canAssign={can('workitem:update')}
            canCreate={can('workitem:create')}
            canStart={can('sprint:manage')}
            onEdit={() => setEditOpen(true)}
            onStartSprint={() =>
              updateSprint.mutate({
                sprintId: selected.id,
                input: { status: SprintStatusEnum.ACTIVE },
              })
            }
            starting={updateSprint.isPending}
            startError={updateSprint.error}
            projectRef={projectKey}
          />
        )}
      </main>

      <SprintFormDialog
        projectRef={projectKey}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={(sprintId) => setSelectedId(sprintId)}
      />
      <SprintFormDialog
        projectRef={projectKey}
        open={editOpen && Boolean(selected)}
        sprint={selected}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}

function SprintDetailView({
  sprint,
  canClose,
  canAssign,
  canCreate,
  canStart,
  starting,
  startError,
  onStartSprint,
  onEdit,
  projectRef,
}: {
  sprint: SprintDetail;
  canClose: boolean;
  canAssign: boolean;
  canCreate: boolean;
  canStart: boolean;
  starting: boolean;
  startError: unknown;
  onStartSprint: () => void;
  onEdit: () => void;
  projectRef: string;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  // Arbre complet (tous types) : Epics + User Stories pour l'affectation,
  // sélecteur de parent pour le dialog de création.
  const { data: fullBacklog, isLoading: backlogLoading } = useBacklog(projectRef, {});

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-6 sm:px-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-ink-900 text-2xl font-bold tracking-tight">{sprint.name}</h2>
          <SprintStatusBadge status={sprint.status} />
        </div>
        <p className="text-ink-500 mt-1 flex items-center gap-1.5 text-sm">
          <CalendarDays className="size-3.5" strokeWidth={1.75} />
          {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canStart && sprint.status === SprintStatusEnum.PLANNED && (
            <Button variant="primary" onClick={onStartSprint} loading={starting}>
              <Play strokeWidth={2} />
              Démarrer
            </Button>
          )}
          {canStart && sprint.status !== SprintStatusEnum.COMPLETED && (
            <Button variant="secondary" onClick={onEdit}>
              <Pencil strokeWidth={1.75} />
              Modifier
            </Button>
          )}
          {canAssign && sprint.status !== SprintStatusEnum.COMPLETED && (
            <Button variant="secondary" onClick={() => setAssignmentOpen(true)}>
              <UserPlus strokeWidth={1.75} />
              Affecter des Work Items
            </Button>
          )}
          {canCreate && sprint.status !== SprintStatusEnum.COMPLETED && (
            <Button variant="secondary" onClick={() => setNewItemOpen(true)}>
              <Plus strokeWidth={2} />
              New Item
            </Button>
          )}
          <Button variant="secondary" onClick={() => setReportOpen(true)}>
            <FileText strokeWidth={1.75} />
            Rapport
          </Button>
          {canClose && sprint.status !== SprintStatusEnum.COMPLETED && (
            <Button variant="primary" onClick={() => setCloseOpen(true)}>
              <Flag strokeWidth={2} />
              Clôturer
            </Button>
          )}
        </div>

        {sprint.goal && (
          <p className="bg-accent-50 text-accent-700 mt-4 flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-base">
            <Target className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {sprint.goal}
          </p>
        )}
      </section>

      <InlineError error={startError} />

      <SprintReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        sprint={sprint}
        projectName={projectRef}
      />

      <SprintAssignmentDialog
        open={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
        projectRef={projectRef}
        sprint={sprint}
        candidates={fullBacklog ?? []}
        loading={backlogLoading}
      />

      <CloseSprintDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        projectRef={projectRef}
        sprint={sprint}
      />

      <CreateWorkItemDialog
        open={newItemOpen}
        onClose={() => setNewItemOpen(false)}
        projectRef={projectRef}
        candidates={fullBacklog ?? []}
        defaultSprintId={sprint.id}
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="Tickets terminés"
          done={sprint.completedItems}
          total={sprint.totalItems}
          tone="success"
        />
        <Metric
          label="Points live"
          done={sprint.liveCompletedPoints}
          total={sprint.liveCommittedPoints}
          tone="accent"
        />
        <Metric label="Points engagés" value={sprint.committedPoints} />
        <Metric label="Points terminés" value={sprint.completedPoints} />
      </section>

      <section className="card overflow-hidden">
        <header className="border-border-subtle flex items-center gap-2 border-b px-4 py-3">
          <h3 className="text-ink-900 text-lg font-semibold">Tickets du sprint</h3>
          <span className="count-pill">{sprint.items.length}</span>
        </header>
        {sprint.items.length === 0 ? (
          <EmptyState title="Aucun ticket affecté" />
        ) : (
          sprint.items.map((item) => (
            <div
              key={item.id}
              className="border-border-subtle hover:bg-surface-muted grid grid-cols-[16px_96px_1fr_auto_32px] items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
            >
              <TypeIcon type={item.type} />
              <TicketKey value={item.key} />
              <span className="text-ink-900 truncate text-base">{item.title}</span>
              <StatusPill status={item.status} />
              <span className="flex justify-end">
                <StoryPoints points={item.storyPoints} compact />
              </span>
            </div>
          ))
        )}
      </section>

      <RetrospectiveEditor projectRef={projectRef} sprint={sprint} />
    </div>
  );
}

/** Types affectés directement à un sprint depuis la page Sprints. */
const ASSIGNABLE_TYPES: readonly WorkItemType[] = [WorkItemType.EPIC, WorkItemType.STORY];

function SprintAssignmentDialog({
  open,
  onClose,
  projectRef,
  sprint,
  candidates,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  projectRef: string;
  sprint: SprintDetail;
  candidates: BacklogNode[];
  loading: boolean;
}) {
  const updateWorkItem = useUpdateWorkItem(projectRef);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saveError, setSaveError] = useState<unknown>(null);
  const [conflicts, setConflicts] = useState<SprintPropagationConflict[] | null>(null);
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  const assignable = useMemo(
    () => flattenBacklog(candidates).filter((item) => ASSIGNABLE_TYPES.includes(item.type)),
    [candidates],
  );
  const availableItems = useMemo(
    () => assignable.filter((item) => item.sprintId === null || item.sprintId === sprint.id),
    [sprint.id, assignable],
  );
  const unavailableCount = assignable.length - availableItems.length;
  const normalizedSearch = search.trim().toLocaleLowerCase('fr');
  const visibleItems = availableItems.filter(
    (item) =>
      !normalizedSearch ||
      `${item.key} ${item.title}`.toLocaleLowerCase('fr').includes(normalizedSearch),
  );

  // La sélection part de l'état serveur à l'ouverture, puis n'est plus écrasée
  // par les rechargements déclenchés pendant l'enregistrement.
  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (initialized.current || loading) return;
    initialized.current = true;
    setSelectedIds(
      new Set(availableItems.filter((item) => item.sprintId === sprint.id).map((item) => item.id)),
    );
    setSearch('');
    setSaveError(null);
    setConflicts(null);
  }, [open, loading, sprint.id, availableItems]);

  /** (Dé)cocher un Epic (dé)coche aussi ses User Stories : c'est ce que fera la propagation backend. */
  const toggle = (item: BacklogNode, checked: boolean) => {
    const affected = [
      item.id,
      ...(item.type === WorkItemType.EPIC
        ? availableItems.filter((child) => child.parentId === item.id).map((child) => child.id)
        : []),
    ];
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of affected) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const targetSprintOf = (itemId: string) => (selectedIds.has(itemId) ? sprint.id : null);

  /**
   * Les Epics sont enregistrés d'abord : le backend propage leur sprint à toute
   * leur descendance (C.1). Les User Stories dont la case a changé sont ensuite
   * enregistrées, ce qui préserve un choix explicite différent de celui de l'Epic.
   */
  const save = async (confirmSprintPropagation = false) => {
    setSaveError(null);
    setSaving(true);
    const changes = availableItems.filter((item) => item.sprintId !== targetSprintOf(item.id));
    const changedEpicIds = changes
      .filter((item) => item.type === WorkItemType.EPIC)
      .map((item) => item.id);
    const storyChanges = changes.filter((item) => item.type !== WorkItemType.EPIC);

    try {
      for (const epicId of changedEpicIds) {
        await updateWorkItem.mutateAsync({
          itemId: epicId,
          input: {
            sprintId: targetSprintOf(epicId),
            ...(confirmSprintPropagation ? { confirmSprintPropagation: true } : {}),
          },
        });
      }
      await Promise.all(
        storyChanges.map((item) =>
          updateWorkItem.mutateAsync({
            itemId: item.id,
            input: { sprintId: targetSprintOf(item.id) },
          }),
        ),
      );
      setConflicts(null);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SPRINT_PROPAGATION_CONFIRMATION_REQUIRED') {
        setConflicts((error.details?.conflicts as SprintPropagationConflict[] | undefined) ?? []);
      } else {
        setSaveError(error);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Affecter des Work Items · ${sprint.name}`}
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving}>
            Enregistrer les affectations
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InlineError error={saveError} />
        <div className="bg-surface-sunken focus-within:border-accent-500 flex h-9 items-center gap-2 rounded-lg border border-transparent px-3">
          <Search className="text-ink-400 size-3.5" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un Epic ou une User Story…"
            aria-label="Rechercher un Work Item à affecter"
            className="text-ink-700 placeholder:text-ink-400 w-full bg-transparent text-sm outline-none"
          />
        </div>

        <p className="text-ink-500 text-xs">
          Affecter un Epic affecte aussi toutes ses User Stories, Bugs et Sous-tâches.
        </p>
        {unavailableCount > 0 && (
          <p className="text-ink-500 text-xs">
            {unavailableCount} Work Item(s) déjà affecté(s) à un autre sprint ne sont pas proposés.
          </p>
        )}

        <div className="border-border-default scrollbar-thin max-h-80 overflow-y-auto rounded-xl border">
          {loading ? (
            <LoadingState />
          ) : visibleItems.length === 0 ? (
            <EmptyState title="Aucun Work Item disponible" />
          ) : (
            visibleItems.map((item) => (
              <label
                key={item.id}
                className="border-border-subtle hover:bg-surface-muted flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={(event) => toggle(item, event.target.checked)}
                  className="size-3.5"
                />
                <span className="flex w-24 shrink-0 items-center gap-1.5">
                  <TypeIcon type={item.type} />
                  <span className="text-ink-500 text-xs font-medium">
                    {LABELS_FR.workItemType[item.type]}
                  </span>
                </span>
                <TicketKey value={item.key} className="w-24 shrink-0" />
                <span
                  className={`text-ink-900 min-w-0 flex-1 truncate text-sm ${
                    item.type === WorkItemType.EPIC ? 'font-semibold' : ''
                  }`}
                >
                  {item.title}
                </span>
                <StatusPill status={item.status} />
              </label>
            ))
          )}
        </div>
      </div>

      <SprintConflictDialog
        open={conflicts !== null}
        conflicts={conflicts ?? []}
        targetSprintName={sprint.name}
        onCancel={() => setConflicts(null)}
        onConfirm={() => void save(true)}
        confirming={saving}
      />
    </Modal>
  );
}

function flattenBacklog(nodes: BacklogNode[]): BacklogNode[] {
  return nodes.flatMap((node) => [node, ...flattenBacklog(node.children)]);
}

function RetrospectiveEditor({ projectRef, sprint }: { projectRef: string; sprint: SprintDetail }) {
  const { can } = useProjectPermissions(projectRef);
  const updateRetro = useUpdateRetrospective(projectRef);
  const [summary, setSummary] = useState(sprint.retroSummary ?? '');
  const [items, setItems] = useState<RetrospectiveItemInput[]>([]);

  useEffect(() => {
    setSummary(sprint.retroSummary ?? '');
    setItems(
      sprint.retrospectiveItems.map((item) => ({
        id: item.id,
        category: item.category,
        content: item.content,
        isDone: item.isDone,
      })),
    );
  }, [sprint]);

  const addItem = (category: RetrospectiveItemInput['category']) =>
    setItems((current) => [...current, { category, content: '', isDone: false }]);

  const save = () =>
    updateRetro.mutate({ sprintId: sprint.id, input: { retroSummary: summary || null, items } });

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-ink-900 text-lg font-semibold">Rétrospective</h3>
        {can('retro:manage') && (
          <Button size="sm" className="ml-auto" onClick={save} loading={updateRetro.isPending}>
            <Save strokeWidth={1.75} />
            Enregistrer
          </Button>
        )}
      </div>
      <InlineError error={updateRetro.error} />
      <label htmlFor="retro-summary" className="text-ink-900 mb-1.5 block text-sm font-semibold">
        Synthèse
      </label>
      <Textarea
        id="retro-summary"
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        placeholder="Synthèse de la rétrospective"
        disabled={!can('retro:manage')}
        className="mb-4"
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {Object.values(RetroCategory).map((category) => {
          const tone = RETRO_TONE[category];
          const categoryItems = items.filter((item) => item.category === category);
          return (
            <div key={category} className={cn('rounded-xl p-3', tone.panel)}>
              <div className="mb-2.5 flex items-center gap-2">
                <span className={cn('size-2 shrink-0 rounded-full', tone.dot)} />
                <span className="text-ink-900 text-sm font-semibold">
                  {LABELS_FR.retroCategory[category]}
                </span>
                {can('retro:manage') && (
                  <button
                    type="button"
                    onClick={() => addItem(category)}
                    className="bg-surface border-border-default text-ink-700 hover:text-ink-900 ml-auto flex size-7 items-center justify-center rounded-lg border shadow-card"
                    aria-label={`Ajouter : ${LABELS_FR.retroCategory[category]}`}
                  >
                    <Plus className="size-3.5" strokeWidth={2} />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {categoryItems.length === 0 && (
                  <p
                    className={cn(
                      'text-ink-500 flex h-16 items-center justify-center rounded-lg border border-dashed text-sm',
                      tone.empty,
                    )}
                  >
                    Aucune note pour l’instant
                  </p>
                )}
                {categoryItems.map((item, index) => (
                  <div key={`${category}-${index}`} className="flex items-start gap-1">
                    <button
                      type="button"
                      disabled={!can('retro:manage')}
                      onClick={() =>
                        setItems((current) =>
                          current.map((entry) =>
                            entry === item ? { ...entry, isDone: !entry.isDone } : entry,
                          ),
                        )
                      }
                      className="text-ink-400 mt-1"
                      aria-label={item.isDone ? 'Marquer a faire' : 'Marquer fait'}
                    >
                      {item.isDone ? (
                        <CheckCircle2 className="size-4 text-green-700" strokeWidth={1.75} />
                      ) : (
                        <XCircle className="size-4" strokeWidth={1.75} />
                      )}
                    </button>
                    <Textarea
                      value={item.content}
                      disabled={!can('retro:manage')}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry) =>
                            entry === item ? { ...entry, content: event.target.value } : entry,
                          ),
                        )
                      }
                      className="bg-surface min-h-10"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Teintes des trois colonnes de rétrospective : vert, orange, bleu. */
const RETRO_TONE: Record<RetroCategory, { panel: string; dot: string; empty: string }> = {
  [RetroCategory.WENT_WELL]: {
    panel: 'bg-green-50/70 dark:bg-green-950/25',
    dot: 'bg-success',
    empty: 'border-green-200 dark:border-green-900/60',
  },
  [RetroCategory.TO_IMPROVE]: {
    panel: 'bg-orange-50/70 dark:bg-orange-950/25',
    dot: 'bg-warning',
    empty: 'border-orange-200 dark:border-orange-900/60',
  },
  [RetroCategory.ACTION_ITEM]: {
    panel: 'bg-accent-50/80',
    dot: 'bg-accent-500',
    empty: 'border-accent-200',
  },
};

/**
 * Indicateur de sprint : ratio « fait / total » avec barre, ou valeur figée à la
 * clôture (`value`), affichée « — » tant que le sprint n'est pas clôturé.
 */
function Metric({
  label,
  done,
  total,
  value,
  tone = 'accent',
}: {
  label: string;
  done?: number;
  total?: number;
  value?: number | null;
  tone?: 'accent' | 'success';
}) {
  const isRatio = done !== undefined && total !== undefined;
  return (
    <div className="card px-4 py-3.5">
      <p className="text-ink-500 text-sm font-medium">{label}</p>
      {isRatio ? (
        <>
          <p className="text-ink-900 mt-1.5 text-3xl font-bold tracking-tight tabular-nums">
            {done}
            <span className="text-ink-400 text-lg font-semibold">/{total}</span>
          </p>
          <div className="mt-2.5">
            <ProgressBar done={done} total={total} tone={tone} />
          </div>
        </>
      ) : value === null || value === undefined ? (
        <>
          <p className="text-ink-400 mt-1.5 text-3xl font-bold">—</p>
          <p className="text-ink-500 mt-1.5 text-xs">Disponible à la clôture</p>
        </>
      ) : (
        <p className="text-ink-900 mt-1.5 text-3xl font-bold tracking-tight tabular-nums">
          {value}
        </p>
      )}
    </div>
  );
}

function ProgressBar({
  done,
  total,
  tone = 'accent',
}: {
  done: number;
  total: number;
  tone?: 'accent' | 'success';
}) {
  const width = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span className="bg-surface-sunken block h-1.5 overflow-hidden rounded-full">
      <span
        className={cn(
          'block h-full rounded-full',
          tone === 'success' ? 'bg-success' : 'bg-accent-500',
        )}
        style={{ width: `${Math.min(width, 100)}%` }}
      />
    </span>
  );
}

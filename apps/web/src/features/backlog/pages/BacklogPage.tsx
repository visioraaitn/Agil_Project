import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, ChevronDown, ChevronRight, GripVertical, Plus, Upload } from 'lucide-react';
import type { BacklogNode } from '@visiora/shared';
import { WorkItemType } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/common/Avatar';
import { AvatarStack } from '@/components/common/AvatarStack';
import { PageHeader } from '@/components/common/PageHeader';
import {
  EmptyState,
  ErrorState,
  InlineError,
  LoadingState,
} from '@/components/common/StateMessage';
import { useProjectMembers, useProjectPermissions } from '@/features/projects/hooks';
import { useProjectCrumbs } from '@/features/projects/use-project-crumbs';
import { CreateWorkItemDialog } from '@/features/work-items/components/CreateWorkItemDialog';
import { FiltersBar } from '@/features/work-items/components/FiltersBar';
import { ImportBacklogDialog } from '@/features/work-items/components/ImportBacklogDialog';
import { WorkItemDetailPanel } from '@/features/work-items/components/WorkItemDetailPanel';
import {
  LabelChips,
  PriorityBadge,
  StatusPill,
  TagChips,
  TicketKey,
  TypeIcon,
} from '@/features/work-items/components/WorkItemChrome';
import { useBacklog, useReorderBacklog } from '@/features/work-items/hooks';
import { useUrlWorkItemFilters } from '@/features/work-items/use-url-work-item-filters';
import { cn } from '@/lib/utils';

/** C.1 · Backlog en liste hiérarchique Epic > Story > Sous-tâche. */
export function BacklogPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const crumbs = useProjectCrumbs(projectKey, 'Backlog');
  const [filters, setFilters] = useUrlWorkItemFilters();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dragError, setDragError] = useState<unknown>(null);

  const { data: tree, isLoading, error } = useBacklog(projectKey, filters);
  const { data: members } = useProjectMembers(projectKey);
  const { can } = useProjectPermissions(projectKey);
  const reorder = useReorderBacklog(projectKey);

  const canReorder = can('backlog:reorder') && (!filters.sortBy || filters.sortBy === 'rank');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const directory = useMemo(() => (members ?? []).map((member) => member.user), [members]);
  const rows = useMemo(() => (tree ? flattenVisible(tree, collapsed) : []), [tree, collapsed]);

  const toggle = (itemId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  /**
   * Le glisser-déposer repriorise entre frères. Déposer une ligne sur un ticket
   * d'un autre parent est refusé plutôt que de deviner un rattachement : le
   * changement de parent se fait explicitement à la création du ticket.
   */
  const onDragEnd = (event: DragEndEvent) => {
    setDragError(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !tree) return;

    const activeRow = rows.find((row) => row.node.id === active.id);
    const overRow = rows.find((row) => row.node.id === over.id);
    if (!activeRow || !overRow) return;

    if (activeRow.node.parentId !== overRow.node.parentId) {
      setDragError(
        new Error(
          'Un ticket se repriorise parmi ses frères ; changez son parent depuis le ticket.',
        ),
      );
      return;
    }

    const siblings = rows
      .filter((row) => row.node.parentId === activeRow.node.parentId)
      .map((row) => row.node)
      .filter((node) => node.id !== activeRow.node.id);

    const overIndex = siblings.findIndex((node) => node.id === overRow.node.id);
    const movingDown = activeRow.index < overRow.index;

    // Vers le bas : on passe sous la cible ; vers le haut : on passe au-dessus.
    const beforeId = movingDown
      ? (siblings[overIndex]?.id ?? null)
      : (siblings[overIndex - 1]?.id ?? null);
    const afterId = movingDown
      ? (siblings[overIndex + 1]?.id ?? null)
      : (siblings[overIndex]?.id ?? null);

    reorder.mutate(
      { itemId: activeRow.node.id, input: { beforeId, afterId } },
      { onError: setDragError },
    );
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 px-4 pt-5 pb-4 sm:px-6">
        <PageHeader
          title="Backlog"
          breadcrumbs={crumbs}
          count={`${rows.length} ligne${rows.length > 1 ? 's' : ''}`}
          actions={
            can('workitem:create') && (
              <>
                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                  <Upload strokeWidth={2} />
                  Importer
                </Button>
                <Button variant="primary" onClick={() => setDialogOpen(true)}>
                  <Plus strokeWidth={2.5} />
                  Nouveau ticket
                </Button>
              </>
            )
          }
        />

        <FiltersBar
          projectRef={projectKey}
          filters={filters}
          onChange={setFilters}
          members={directory}
          showHideDone
        />

        {dragError ? <InlineError error={dragError} /> : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 sm:px-6">
        <div className="card flex max-h-full min-h-0 flex-col overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState
              title="Backlog vide"
              description="Créez un epic ou une user story pour démarrer la planification."
            />
          ) : (
            <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                accessibility={{
                  screenReaderInstructions: {
                    draggable:
                      'Appuyez sur Espace ou Entrée pour saisir le ticket, utilisez les flèches pour le déplacer, puis validez avec Espace ou Entrée.',
                  },
                }}
                onDragEnd={onDragEnd}
              >
                <div className="min-w-[980px]">
                  <div className="border-border-default bg-surface-muted text-ink-500 sticky top-0 z-10 flex h-10 items-center gap-3 border-b px-4 text-[11px] font-semibold tracking-wider uppercase">
                    <span className="w-4" />
                    <span className="flex-1">Titre</span>
                    <span className="w-44">Statut</span>
                    <span className="w-24">Priorité</span>
                    <span className="w-10 text-right">Pts</span>
                    <span className="w-40">Créé par</span>
                    <span className="w-16 text-center">Assigné</span>
                  </div>

                  <SortableContext
                    items={rows.map((row) => row.node.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {rows.map((row) => (
                      <BacklogRow
                        key={row.node.id}
                        row={row}
                        collapsed={collapsed.has(row.node.id)}
                        onToggle={toggle}
                        onOpen={setOpenItemId}
                        draggable={canReorder}
                      />
                    ))}
                  </SortableContext>
                </div>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      <CreateWorkItemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        projectRef={projectKey}
        candidates={tree ?? []}
      />

      <ImportBacklogDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        projectRef={projectKey}
      />

      <WorkItemDetailPanel
        projectRef={projectKey}
        itemId={openItemId}
        onClose={() => setOpenItemId(null)}
      />
    </div>
  );
}

interface FlatRow {
  node: BacklogNode;
  depth: number;
  index: number;
}

/** Aplatit l'arbre en ne gardant que les branches dépliées. */
function flattenVisible(
  nodes: BacklogNode[],
  collapsed: Set<string>,
  depth = 0,
  accumulator: FlatRow[] = [],
): FlatRow[] {
  for (const node of nodes) {
    accumulator.push({ node, depth, index: accumulator.length });
    if (!collapsed.has(node.id) && node.children.length > 0) {
      flattenVisible(node.children, collapsed, depth + 1, accumulator);
    }
  }
  return accumulator;
}

function BacklogRow({
  row,
  collapsed,
  onToggle,
  onOpen,
  draggable,
}: {
  row: FlatRow;
  collapsed: boolean;
  onToggle: (itemId: string) => void;
  onOpen: (itemId: string) => void;
  draggable: boolean;
}) {
  const { node, depth } = row;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: !draggable,
  });

  const hasChildren = node.children.length > 0;
  const isEpic = node.type === WorkItemType.EPIC;
  const points = node.storyPoints ?? (node.rolledUpPoints || null);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-border-subtle hover:bg-accent-50/40 group flex h-11 items-center gap-3 border-b px-4 last:border-b-0',
        isEpic && 'bg-surface-muted',
        isDragging && 'bg-accent-50 relative z-10 opacity-70 shadow-raised',
      )}
    >
      <div className="flex w-4 shrink-0 items-center">
        {draggable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Repositionner ${node.key}`}
            className="text-border-strong hover:text-ink-500 focus-visible:ring-accent-500 cursor-grab rounded focus-visible:ring-2 focus-visible:outline-none"
          >
            <GripVertical className="size-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2" style={{ paddingLeft: depth * 18 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-label={collapsed ? 'Déplier' : 'Replier'}
            aria-expanded={!collapsed}
            className="text-ink-500 hover:bg-surface-sunken hover:text-ink-900 flex size-5 shrink-0 items-center justify-center rounded-md"
          >
            {collapsed ? (
              <ChevronRight className="size-4" strokeWidth={2} />
            ) : (
              <ChevronDown className="size-4" strokeWidth={2} />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <TypeIcon type={node.type} boxed={isEpic} />
        <TicketKey value={node.key} className="shrink-0" />
        <button
          type="button"
          onClick={() => onOpen(node.id)}
          title={node.title}
          className={cn(
            'text-ink-900 hover:text-accent-700 min-w-0 truncate text-left text-base',
            isEpic ? 'font-semibold' : 'font-medium',
          )}
        >
          {node.title}
        </button>
        <span className="flex shrink-0 items-center gap-1">
          <TagChips tags={node.tags} />
          <LabelChips labels={node.labels} />
        </span>
        {node.isBlocked && (
          <span className="text-danger inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
            <AlertTriangle className="size-3.5" strokeWidth={2} />
            bloqué
          </span>
        )}
        {hasChildren && <ChildProgress done={node.doneChildCount} total={node.childCount} />}
      </div>

      <span className="w-44 shrink-0">
        <StatusPill status={node.status} />
      </span>
      <span className="w-24 shrink-0">
        <PriorityBadge priority={node.priority} variant="text" />
      </span>
      <span className="text-ink-900 w-10 shrink-0 text-right text-base font-semibold tabular-nums">
        {points ?? <span className="text-ink-400">—</span>}
      </span>
      <span className="flex w-40 shrink-0 items-center gap-2 overflow-hidden">
        <Avatar name={node.reporter.name} avatarUrl={node.reporter.avatarUrl} />
        <span className="text-ink-600 truncate text-sm" title={node.reporter.name}>
          {node.reporter.name}
        </span>
      </span>
      <span className="flex w-16 shrink-0 justify-center">
        <AvatarStack users={node.assignees} />
      </span>
    </div>
  );
}

/** Mini-barre d'avancement des enfants (« 1/2 ») dans la ligne du parent. */
function ChildProgress({ done, total }: { done: number; total: number }) {
  const ratio = total > 0 ? done / total : 0;
  return (
    <span className="flex shrink-0 items-center gap-1.5" title={`${done}/${total} terminés`}>
      <span className="bg-surface-sunken block h-1 w-7 overflow-hidden rounded-full">
        <span
          className="bg-success block h-full rounded-full"
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
      <span className="text-ink-500 text-xs tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}

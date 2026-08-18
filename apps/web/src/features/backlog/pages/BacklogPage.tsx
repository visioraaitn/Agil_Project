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
import { ChevronDown, ChevronRight, GripVertical, Plus } from 'lucide-react';
import type { BacklogNode } from '@visiora/shared';
import { WorkItemStatus } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState, ErrorState, InlineError, LoadingState } from '@/components/common/StateMessage';
import { useProjectMembers, useProjectPermissions } from '@/features/projects/hooks';
import { CreateWorkItemDialog } from '@/features/work-items/components/CreateWorkItemDialog';
import { FiltersBar } from '@/features/work-items/components/FiltersBar';
import { WorkItemDetailPanel } from '@/features/work-items/components/WorkItemDetailPanel';
import {
  LabelChips,
  PriorityBadge,
  StatusPill,
  StoryPoints,
  TypeIcon,
} from '@/features/work-items/components/WorkItemChrome';
import { useBacklog, useReorderBacklog } from '@/features/work-items/hooks';
import { useUrlWorkItemFilters } from '@/features/work-items/use-url-work-item-filters';
import { cn } from '@/lib/utils';

/** C.1 · Backlog en liste hiérarchique Epic > Story > Sous-tâche. */
export function BacklogPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const [filters, setFilters] = useUrlWorkItemFilters();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragError, setDragError] = useState<unknown>(null);

  const { data: tree, isLoading, error } = useBacklog(projectKey, filters);
  const { data: members } = useProjectMembers(projectKey);
  const { can } = useProjectPermissions(projectKey);
  const reorder = useReorderBacklog(projectKey);

  const canReorder = can('backlog:reorder');
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
        new Error('Un ticket se repriorise parmi ses frères ; changez son parent depuis le ticket.'),
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
      <header className="border-border-subtle flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <h1 className="text-ink-900 text-xl font-semibold">Backlog</h1>
        <span className="text-ink-400 text-sm">{rows.length} ligne(s)</span>
        {can('workitem:create') && (
          <Button variant="primary" className="ml-auto" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3.5" strokeWidth={2.5} />
            Nouveau ticket
          </Button>
        )}
      </header>

      <FiltersBar
        projectRef={projectKey}
        filters={filters}
        onChange={setFilters}
        members={directory}
        showHideDone
      />

      {dragError ? (
        <div className="px-4 pt-2">
          <InlineError error={dragError} />
        </div>
      ) : null}

      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <EmptyState
            title="Backlog vide"
            description="Créez un epic ou une user story pour démarrer la planification."
          />
        ) : (
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
            <div className="border-border-subtle text-ink-500 flex items-center gap-2 border-b px-4 py-1 text-xs font-semibold uppercase">
              <span className="w-6" />
              <span className="flex-1">Titre</span>
              <span className="w-28">Statut</span>
              <span className="w-24">Priorité</span>
              <span className="w-10 text-center">Pts</span>
              <span className="w-8" />
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
          </DndContext>
        )}
      </div>

      <CreateWorkItemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        projectRef={projectKey}
        candidates={tree ?? []}
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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-border-subtle hover:bg-surface-muted flex items-center gap-2 border-b px-4 py-1',
        isDragging && 'bg-accent-50 opacity-60',
        node.status === WorkItemStatus.DONE && 'opacity-60',
      )}
    >
      <div className="flex w-6 shrink-0 items-center" style={{ paddingLeft: depth * 14 }}>
        {draggable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Repositionner ${node.key}`}
            className="text-ink-400 hover:text-ink-700 focus-visible:ring-accent-500 cursor-grab rounded focus-visible:ring-2 focus-visible:outline-none"
          >
            <GripVertical className="size-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5" style={{ paddingLeft: depth * 14 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-label={collapsed ? 'Déplier' : 'Replier'}
            aria-expanded={!collapsed}
            className="text-ink-400 hover:text-ink-700 shrink-0"
          >
            {collapsed ? (
              <ChevronRight className="size-3.5" strokeWidth={2} />
            ) : (
              <ChevronDown className="size-3.5" strokeWidth={2} />
            )}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        <TypeIcon type={node.type} />
        <span className="text-ink-400 shrink-0 text-xs font-semibold">{node.key}</span>
        <button
          type="button"
          onClick={() => onOpen(node.id)}
          className="text-ink-900 hover:text-accent-700 min-w-0 truncate text-left text-base hover:underline"
        >
          {node.title}
        </button>
        <LabelChips labels={node.labels} />
        {node.isBlocked && (
          <span className="bg-red-50 text-danger rounded px-1 text-xs font-semibold">bloqué</span>
        )}
        {hasChildren && (
          <span className="text-ink-400 shrink-0 text-xs">
            {node.doneChildCount}/{node.childCount}
          </span>
        )}
      </div>

      <span className="w-28 shrink-0">
        <StatusPill status={node.status} />
      </span>
      <span className="w-24 shrink-0">
        <PriorityBadge priority={node.priority} />
      </span>
      <span className="flex w-10 shrink-0 justify-center">
        <StoryPoints points={node.storyPoints ?? (node.rolledUpPoints || null)} />
      </span>
      <span className="flex w-8 shrink-0 justify-end">
        {node.assignee && <Avatar name={node.assignee.name} avatarUrl={node.assignee.avatarUrl} />}
      </span>
    </div>
  );
}

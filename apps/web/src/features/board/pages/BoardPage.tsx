import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import {
  LABELS_FR,
  type BoardColumn,
  type WorkItemStatus,
  type WorkItemSummary,
} from '@visiora/shared';
import { ErrorState, LoadingState } from '@/components/common/StateMessage';
import { useProjectMembers, useProjectPermissions } from '@/features/projects/hooks';
import { FiltersBar } from '@/features/work-items/components/FiltersBar';
import { WorkItemCard } from '@/features/work-items/components/WorkItemCard';
import { WorkItemDetailPanel } from '@/features/work-items/components/WorkItemDetailPanel';
import { useBoard, useMoveWorkItem } from '@/features/work-items/hooks';
import { useUrlWorkItemFilters } from '@/features/work-items/use-url-work-item-filters';

const COLUMN_PREFIX = 'column:';

/** D.1 · Task Board Kanban avec glisser-déposer entre colonnes. */
export function BoardPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const [filters, setFilters] = useUrlWorkItemFilters();
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const { data: columns, isLoading, error } = useBoard(projectKey, filters);
  const { data: members } = useProjectMembers(projectKey);
  const { can } = useProjectPermissions(projectKey);
  const move = useMoveWorkItem(projectKey, filters);

  const canMove = can('workitem:move');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const directory = useMemo(
    () => (members ?? []).map((member) => member.user),
    [members],
  );

  const draggedItem = useMemo(
    () => columns?.flatMap((column) => column.items).find((item) => item.id === draggedId) ?? null,
    [columns, draggedId],
  );

  const onDragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    const { active, over } = event;
    if (!over || !columns) return;

    const itemId = String(active.id);
    const overId = String(over.id);

    const target = resolveDropTarget(columns, itemId, overId);
    if (!target) return;

    const source = columns.find((column) => column.items.some((item) => item.id === itemId));
    const unchanged =
      source?.status === target.status &&
      target.beforeId === null &&
      target.afterId === null &&
      source.items.at(-1)?.id === itemId;
    if (unchanged) return;

    move.mutate({
      itemId,
      input: { status: target.status, beforeId: target.beforeId, afterId: target.afterId },
    });
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!columns) return null;

  return (
    <div className="flex h-full flex-col">
      <header className="border-border-subtle flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <h1 className="text-ink-900 text-xl font-semibold">Task Board</h1>
        <span className="text-ink-400 text-sm">
          {columns.reduce((total, column) => total + column.count, 0)} ticket(s)
        </span>
        {!canMove && (
          <span className="text-ink-400 ml-auto text-sm">
            Lecture seule — votre rôle ne permet pas de déplacer les tickets.
          </span>
        )}
      </header>

      <FiltersBar
        projectRef={projectKey}
        filters={filters}
        onChange={setFilters}
        members={directory}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Appuyez sur Espace ou Entrée pour saisir la carte, utilisez les flèches pour la déplacer, puis validez avec Espace ou Entrée.',
          },
        }}
        onDragStart={(event: DragStartEvent) => setDraggedId(String(event.active.id))}
        onDragCancel={() => setDraggedId(null)}
        onDragEnd={onDragEnd}
      >
        <div className="scrollbar-thin flex min-h-0 flex-1 gap-2 overflow-x-auto p-3">
          {columns.map((column) => (
            <Column
              key={column.status}
              column={column}
              onOpen={setOpenItemId}
              draggable={canMove}
            />
          ))}
        </div>

        <DragOverlay>
          {draggedItem && (
            <div className="w-64 rotate-1">
              <WorkItemCard item={draggedItem} onOpen={() => undefined} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <WorkItemDetailPanel
        projectRef={projectKey}
        itemId={openItemId}
        onClose={() => setOpenItemId(null)}
      />
    </div>
  );
}

function Column({
  column,
  onOpen,
  draggable,
}: {
  column: BoardColumn;
  onOpen: (itemId: string) => void;
  draggable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${column.status}` });

  return (
    <section className="flex w-64 shrink-0 flex-col">
      <header className="border-border-default bg-surface-muted flex items-center gap-2 rounded-t border border-b-0 px-2 py-1.5">
        <h2 className="text-ink-700 text-sm font-semibold">
          {LABELS_FR.workItemStatus[column.status]}
        </h2>
        <span className="text-ink-400 text-xs">{column.count}</span>
        {column.points > 0 && (
          <span className="text-ink-400 ml-auto text-xs">{column.points} pts</span>
        )}
      </header>

      <div
        ref={setNodeRef}
        className={`scrollbar-thin border-border-default flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto rounded-b border p-1.5 ${
          isOver ? 'bg-accent-50' : 'bg-surface-sunken'
        }`}
      >
        <SortableContext
          items={column.items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.items.map((item) => (
            <SortableCard key={item.id} item={item} onOpen={onOpen} disabled={!draggable} />
          ))}
        </SortableContext>

        {column.items.length === 0 && (
          <p className="text-ink-400 py-6 text-center text-xs">Aucun ticket</p>
        )}
      </div>
    </section>
  );
}

function SortableCard({
  item,
  onOpen,
  disabled,
}: {
  item: WorkItemSummary;
  onOpen: (itemId: string) => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  });

  return (
    <WorkItemCard
      ref={setNodeRef}
      item={item}
      onOpen={onOpen}
      dragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

/**
 * Traduit la cible d'un dépôt en statut + voisins.
 * `beforeId` est la carte au-dessus, `afterId` celle en dessous : le serveur
 * calcule un rang entre les deux, sans renumérotation.
 */
function resolveDropTarget(
  columns: BoardColumn[],
  itemId: string,
  overId: string,
): { status: WorkItemStatus; beforeId: string | null; afterId: string | null } | null {
  if (overId.startsWith(COLUMN_PREFIX)) {
    const status = overId.slice(COLUMN_PREFIX.length) as WorkItemStatus;
    const items = (columns.find((column) => column.status === status)?.items ?? []).filter(
      (item) => item.id !== itemId,
    );
    return { status, beforeId: items.at(-1)?.id ?? null, afterId: null };
  }

  const targetColumn = columns.find((column) => column.items.some((item) => item.id === overId));
  if (!targetColumn) return null;

  const items = targetColumn.items.filter((item) => item.id !== itemId);
  const overIndex = items.findIndex((item) => item.id === overId);
  if (overIndex === -1) {
    return { status: targetColumn.status, beforeId: items.at(-1)?.id ?? null, afterId: null };
  }

  // Dépôt sur une carte : on s'insère juste au-dessus d'elle.
  return {
    status: targetColumn.status,
    beforeId: overIndex > 0 ? (items[overIndex - 1]?.id ?? null) : null,
    afterId: overId,
  };
}

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CalendarDays, ChevronDown, Columns3, Flag, Layers, SquareDashed } from 'lucide-react';
import {
  LABELS_FR,
  Priority,
  WorkItemStatus,
  WorkItemType,
  type BacklogNode,
  type BoardColumn,
  type WorkItemSummary,
} from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/common/Avatar';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateMessage';
import { useProjectMembers, useProjectPermissions } from '@/features/projects/hooks';
import { useProjectCrumbs } from '@/features/projects/use-project-crumbs';
import { defaultSprintId, useSprints } from '@/features/sprints/hooks';
import { SprintStatusBadge } from '@/features/sprints/components/SprintStatusBadge';
import { formatSprintDate } from '@/features/sprints/format';
import { CreateWorkItemDialog } from '@/features/work-items/components/CreateWorkItemDialog';
import { FiltersBar } from '@/features/work-items/components/FiltersBar';
import { TypeIcon } from '@/features/work-items/components/WorkItemChrome';
import { WorkItemCard } from '@/features/work-items/components/WorkItemCard';
import { WorkItemDetailPanel } from '@/features/work-items/components/WorkItemDetailPanel';
import {
  toBoardColumnsInput,
  useBacklog,
  useBoard,
  useMoveWorkItem,
  useSaveBoardColumns,
} from '@/features/work-items/hooks';
import { useUrlWorkItemFilters } from '@/features/work-items/use-url-work-item-filters';
import { cn } from '@/lib/utils';
import { parseColumnDropId, parseColumnSortId, type BoardDragData } from '../board-dnd';
import { BoardColumnsConfigDialog } from '../components/BoardColumnsConfigDialog';
import { BoardGrid, type BoardGridSection } from '../components/BoardGrid';
import { ColumnHeaderContent } from '../components/ColumnHeader';
import {
  CARD_TYPES,
  ROW_TYPES,
  boardRowItems,
  buildBoardRows,
  childTypesOf,
  rootEpicIds,
} from '../hierarchy';

type SwimlaneMode = 'none' | 'assignee' | 'epic' | 'priority' | 'hierarchy';

const SWIMLANE_OPTIONS: { value: SwimlaneMode; label: string }[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'assignee', label: 'Assigné' },
  { value: 'epic', label: 'Epic' },
  { value: 'priority', label: 'Priorité' },
  { value: 'hierarchy', label: 'Hiérarchie' },
];

const PRIORITY_TILE: Record<Priority, string> = {
  [Priority.CRITICAL]: 'bg-red-50 text-danger dark:bg-red-950/40',
  [Priority.HIGH]: 'bg-orange-50 text-warning dark:bg-orange-950/40',
  [Priority.MEDIUM]: 'bg-surface-sunken text-ink-500',
  [Priority.LOW]: 'bg-surface-sunken text-ink-400',
};

/** Couloir : un groupe de lignes (Epic, Story, Bug) du board. */
interface SwimlaneGroup {
  id: string;
  title: string;
  icon: ReactNode;
  items: BacklogNode[];
}

/** Ticket parent et types proposés du dialogue de création. */
interface CreateContext {
  parent: BacklogNode;
  types: WorkItemType[];
}

const sumPoints = (items: WorkItemSummary[]) =>
  items.reduce((total, item) => total + (item.storyPoints ?? 0), 0);

/** Paramètres d'URL qui trient sans filtrer : ils ne masquent aucune ligne. */
const NON_FILTER_KEYS = new Set(['sortBy', 'sortOrder', 'hideDone']);

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`;

/**
 * Les deux glisser-déposer du board partagent un DndContext : une colonne ne
 * se pose que sur un en-tête de colonne, une carte jamais sur un en-tête.
 */
const boardCollisionDetection: CollisionDetection = (args) => {
  const isColumnDrag = (args.active.data.current as BoardDragData | undefined)?.kind === 'column';
  const droppableContainers = args.droppableContainers.filter(
    (container) =>
      ((container.data.current as { kind?: string } | undefined)?.kind === 'column') ===
      isColumnDrag,
  );
  return isColumnDrag
    ? closestCenter({ ...args, droppableContainers })
    : closestCorners({ ...args, droppableContainers });
};

/** D.1 · Task Board Kanban avec Swimlanes (couloirs), colonnes personnalisables et création rapide. */
export function BoardPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const crumbs = useProjectCrumbs(projectKey, 'Boards');
  const [filters, setFilters] = useUrlWorkItemFilters();
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [createContext, setCreateContext] = useState<CreateContext | null>(null);
  const [swimlane, setSwimlane] = useState<SwimlaneMode>('hierarchy');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Les couloirs vides sont repliés par défaut ; on mémorise ceux que l’utilisateur a ouverts.
  const [expandedEmptyLanes, setExpandedEmptyLanes] = useState<Set<string>>(new Set());

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const { data: sprints, isLoading: sprintsLoading, error: sprintsError } = useSprints(projectKey);

  // Le sprint actif est sélectionné automatiquement à l'ouverture ; l'utilisateur
  // peut ensuite en choisir un autre via le sélecteur du header.
  useEffect(() => {
    if (selectedSprintId) return;
    const fallback = defaultSprintId(sprints);
    if (fallback) setSelectedSprintId(fallback);
  }, [selectedSprintId, sprints]);

  const selectedSprint = sprints?.find((sprint) => sprint.id === selectedSprintId) ?? null;
  const boardFilters = useMemo(
    () => ({ ...filters, sprintId: selectedSprint?.id }),
    [selectedSprint?.id, filters],
  );
  const {
    data: columns,
    isLoading,
    error,
  } = useBoard(projectKey, boardFilters, Boolean(selectedSprint));
  const { data: tree } = useBacklog(projectKey, {});
  const { data: members } = useProjectMembers(projectKey);
  const { can } = useProjectPermissions(projectKey);
  const move = useMoveWorkItem(projectKey, boardFilters);
  const saveColumns = useSaveBoardColumns(projectKey);

  const canMove = can('workitem:move');
  const canCreate = can('workitem:create');
  const canConfigure = can('board:configure');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const directory = useMemo(() => (members ?? []).map((member) => member.user), [members]);

  const visibleColumns = useMemo(
    () => (columns ?? []).filter((column) => column.isVisible),
    [columns],
  );
  const visibleItems = useMemo(
    () => visibleColumns.flatMap((column) => column.items),
    [visibleColumns],
  );

  const draggedItem = useMemo(
    () => visibleItems.find((item) => item.id === draggedId) ?? null,
    [visibleItems, draggedId],
  );
  const draggedColumn = visibleColumns.find((column) => column.id === draggedColumnId) ?? null;

  const epicOf = useMemo(() => rootEpicIds(tree ?? []), [tree]);
  const sprintId = selectedSprint?.id ?? null;
  // Filtres actifs : seules les lignes portant des sous-tâches correspondantes restent.
  const filtersActive = Object.entries(filters).some(
    ([key, value]) => !NON_FILTER_KEYS.has(key) && value !== undefined && value !== '',
  );
  const rowItems = useMemo(
    () => boardRowItems(tree ?? [], visibleItems, sprintId, filtersActive),
    [tree, visibleItems, sprintId, filtersActive],
  );

  // Couloirs : ils regroupent les lignes du board ; chaque ligne n'appartient
  // qu'à un seul couloir et emporte ses sous-tâches avec elle.
  const swimlaneGroups = useMemo<SwimlaneGroup[]>(() => {
    if (swimlane === 'assignee') {
      // Couloir de l'assigné principal : un ticket à plusieurs assignés n'est pas répété.
      const groups: SwimlaneGroup[] = directory.map((user) => ({
        id: `user-${user.id}`,
        title: user.name,
        icon: <Avatar name={user.name} avatarUrl={user.avatarUrl} />,
        items: rowItems.filter((item) => item.assignees[0]?.id === user.id),
      }));
      const placed = new Set(groups.flatMap((group) => group.items.map((item) => item.id)));
      const unassigned = rowItems.filter((item) => !placed.has(item.id));
      if (unassigned.length > 0) {
        groups.push({
          id: 'unassigned',
          title: 'Non assigné',
          icon: (
            <span className="border-border-strong text-ink-400 flex size-6 items-center justify-center rounded-full border border-dashed text-[10px]">
              ?
            </span>
          ),
          items: unassigned,
        });
      }
      return groups;
    }

    if (swimlane === 'priority') {
      return [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW]
        .map((p) => ({
          id: `priority-${p}`,
          title: LABELS_FR.priority[p],
          icon: (
            <span
              className={cn('flex size-6 items-center justify-center rounded-md', PRIORITY_TILE[p])}
            >
              <Flag className="size-3.5" strokeWidth={2} />
            </span>
          ),
          items: rowItems.filter((item) => item.priority === p),
        }))
        .filter((g) => g.items.length > 0);
    }

    if (swimlane === 'epic') {
      // L'Epic d'une ligne est résolu par les vraies relations parent/enfant ;
      // la ligne de l'Epic lui-même ouvre son couloir.
      const epics = (tree ?? []).filter((node) => node.type === WorkItemType.EPIC);
      const groups: SwimlaneGroup[] = epics.map((epic) => ({
        id: `epic-${epic.id}`,
        title: `${epic.key} · ${epic.title}`,
        icon: <TypeIcon type={WorkItemType.EPIC} boxed />,
        items: rowItems.filter((item) => epicOf.get(item.id) === epic.id),
      }));
      const withoutEpic = rowItems.filter((item) => !epicOf.has(item.id));
      if (withoutEpic.length > 0) {
        groups.push({
          id: 'no-epic',
          title: 'Hors Epic',
          icon: (
            <span className="bg-surface-sunken text-ink-500 flex size-6 items-center justify-center rounded-md">
              <SquareDashed className="size-3.5" strokeWidth={2} />
            </span>
          ),
          items: withoutEpic,
        });
      }
      return groups;
    }

    return [];
  }, [swimlane, rowItems, directory, tree, epicOf]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleEmptyLane = (laneId: string) =>
    setExpandedEmptyLanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });

  // Sections de la grille : le board entier (à plat ou par hiérarchie), ou un
  // couloir par groupe — la colonne Work Items est la même partout.
  const { sections, collapsibleIds } = useMemo(() => {
    const base = { sprintId, onlyWithCards: filtersActive, collapsed };

    if (swimlane === 'none' || swimlane === 'hierarchy') {
      const { rows, collapsibleIds: ids } = buildBoardRows(tree ?? [], visibleItems, {
        ...base,
        nested: swimlane === 'hierarchy',
      });
      return { sections: [{ id: 'all', rows }] as BoardGridSection[], collapsibleIds: ids };
    }

    const ids: string[] = [];
    const result: BoardGridSection[] = swimlaneGroups.map((lane) => {
      const laneIds = new Set(lane.items.map((item) => item.id));
      const { rows, collapsibleIds: rowIds } = buildBoardRows(tree ?? [], visibleItems, {
        ...base,
        include: (item) => laneIds.has(item.id),
        // Le bandeau du couloir est déjà l'Epic : ses Stories y sont des lignes de premier niveau.
        nested: false,
        scope: `${lane.id}|`,
        withUnlinked: false,
      });
      const isEmpty = lane.items.length === 0;
      const laneCollapsed = isEmpty ? !expandedEmptyLanes.has(lane.id) : collapsed.has(lane.id);
      if (!isEmpty) ids.push(lane.id);
      ids.push(...rowIds);
      const subtasks = visibleItems.filter((card) => card.parentId && laneIds.has(card.parentId));
      return {
        id: lane.id,
        lane: {
          title: lane.title,
          icon: lane.icon,
          summary: `${plural(lane.items.length, 'work item')} · ${plural(subtasks.length, 'carte')} · ${sumPoints(subtasks)} pts`,
          collapsed: laneCollapsed,
          onToggle: () => (isEmpty ? toggleEmptyLane(lane.id) : toggle(lane.id)),
        },
        rows,
      };
    });

    // Les sous-tâches dont le parent est introuvable ne disparaissent jamais.
    const orphans = buildBoardRows(tree ?? [], visibleItems, {
      ...base,
      include: () => false,
      scope: 'orphans|',
    }).rows;
    if (orphans.length > 0) result.push({ id: 'orphans', rows: orphans });

    return { sections: result, collapsibleIds: ids };
  }, [
    swimlane,
    tree,
    visibleItems,
    swimlaneGroups,
    collapsed,
    expandedEmptyLanes,
    sprintId,
    filtersActive,
  ]);

  const onDragStart = (event: DragStartEvent) => {
    const columnId = parseColumnSortId(String(event.active.id));
    if (columnId) setDraggedColumnId(columnId);
    else setDraggedId(String(event.active.id));
  };

  /** Réordonne les colonnes visibles et enregistre l'ordre complet (colonnes masquées comprises). */
  const reorderColumns = (activeId: string, overId: string) => {
    if (!columns) return;
    const fromId = parseColumnSortId(activeId);
    const toId = parseColumnSortId(overId);
    if (!fromId || !toId || fromId === toId) return;

    const from = visibleColumns.findIndex((column) => column.id === fromId);
    const to = visibleColumns.findIndex((column) => column.id === toId);
    if (from === -1 || to === -1) return;

    const reorderedVisible = arrayMove(visibleColumns, from, to);
    let next = 0;
    const fullOrder = columns.map((column) =>
      column.isVisible ? (reorderedVisible[next++] ?? column) : column,
    );
    saveColumns.mutate(toBoardColumnsInput(fullOrder));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    setDraggedColumnId(null);
    const { active, over } = event;
    if (!over || !columns) return;

    if ((active.data.current as BoardDragData | undefined)?.kind === 'column') {
      reorderColumns(String(active.id), String(over.id));
      return;
    }

    const itemId = String(active.id);
    const target = resolveDropTarget(columns, itemId, String(over.id));
    if (!target) return;

    const source = columns.find((column) => column.items.some((item) => item.id === itemId));
    const unchanged =
      source?.id === target.columnId &&
      target.beforeId === null &&
      target.afterId === null &&
      source.items.at(-1)?.id === itemId;
    if (unchanged) return;

    move.mutate({
      itemId,
      input: { columnId: target.columnId, beforeId: target.beforeId, afterId: target.afterId },
    });
  };

  if (sprintsLoading || isLoading) return <LoadingState />;
  if (sprintsError || error) return <ErrorState error={sprintsError ?? error} />;
  if (!selectedSprint) {
    return (
      <div className="flex h-full flex-col px-4 pt-5 sm:px-6">
        <PageHeader title="Task Board" breadcrumbs={crumbs} />
        <EmptyState
          title={sprints && sprints.length > 0 ? 'Sélectionnez un sprint' : 'Aucun sprint'}
          description="Créez un sprint et affectez-y des User Stories pour alimenter le board."
        />
      </div>
    );
  }
  if (!columns) return null;

  const cardsOnBoard = visibleColumns.flatMap((column) => column.items);
  const subtaskCount = cardsOnBoard.filter((card) => card.type === WorkItemType.SUBTASK).length;
  const bugCount = cardsOnBoard.filter((card) => card.type === WorkItemType.BUG).length;
  // Lignes réellement affichées (un Epic de regroupement compte, un couloir replié aussi).
  const workItemCount = new Set(
    sections.flatMap((section) =>
      section.rows.flatMap((row) => (row.kind === 'work-item' ? [row.item.id] : [])),
    ),
  ).size;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 px-4 pt-5 pb-4 sm:px-6">
        <PageHeader
          title="Task Board"
          breadcrumbs={crumbs}
          count={[
            plural(workItemCount, 'work item'),
            plural(subtaskCount, 'sous-tâche'),
            ...(bugCount > 0 ? [plural(bugCount, 'bug')] : []),
          ].join(' · ')}
          meta={
            <>
              <label htmlFor="board-sprint" className="text-ink-600 text-sm font-semibold">
                Sprint
              </label>
              <div className="card hover:border-border-strong relative flex h-9 cursor-pointer items-center gap-2 pr-2.5 pl-3 transition-colors">
                <CalendarDays className="text-accent-500 size-4 shrink-0" strokeWidth={1.75} />
                <select
                  id="board-sprint"
                  value={selectedSprint.id}
                  onChange={(event) => setSelectedSprintId(event.target.value)}
                  className="text-ink-900 absolute inset-0 cursor-pointer opacity-0"
                >
                  {(sprints ?? []).map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name} · {LABELS_FR.sprintStatus[sprint.status]}
                    </option>
                  ))}
                </select>
                <span className="text-ink-900 max-w-56 truncate text-base font-medium">
                  {selectedSprint.name}
                </span>
                <SprintStatusBadge status={selectedSprint.status} />
                <ChevronDown className="text-ink-500 size-4 shrink-0" strokeWidth={2} />
              </div>
              <span className="text-ink-500 text-sm whitespace-nowrap" aria-live="polite">
                {formatSprintDate(selectedSprint.startDate)} –{' '}
                {formatSprintDate(selectedSprint.endDate)}
              </span>
              {!canMove && <span className="count-pill">Lecture seule</span>}
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="bg-surface-sunken flex items-center gap-0.5 rounded-lg p-1"
            role="radiogroup"
            aria-label="Couloirs"
          >
            <span className="text-ink-600 flex items-center gap-1.5 px-2 text-sm font-semibold">
              <Layers className="size-3.5" strokeWidth={2} />
              Couloirs
            </span>
            {SWIMLANE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={swimlane === option.value}
                onClick={() => setSwimlane(option.value)}
                className={cn(
                  'h-7 rounded-md px-3 text-sm font-medium transition-colors',
                  swimlane === option.value
                    ? 'bg-surface text-accent-700 shadow-raised font-semibold'
                    : 'text-ink-600 hover:text-ink-900',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {canConfigure && (
            <Button onClick={() => setConfigOpen(true)}>
              <Columns3 strokeWidth={1.75} />
              Colonnes
            </Button>
          )}
        </div>

        <FiltersBar
          projectRef={projectKey}
          filters={filters}
          onChange={setFilters}
          members={directory}
          showMemberQuickFilter
          showTypeFilter={false}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Appuyez sur Espace ou Entrée pour saisir l’élément, utilisez les flèches pour le déplacer, puis validez avec Espace ou Entrée.',
          },
        }}
        onDragStart={onDragStart}
        onDragCancel={() => {
          setDraggedId(null);
          setDraggedColumnId(null);
        }}
        onDragEnd={onDragEnd}
      >
        <div className="scrollbar-thin min-h-0 flex-1 overflow-auto px-4 pb-6 sm:px-6">
          <BoardGrid
            columns={visibleColumns}
            sections={sections}
            hasCollapsible={collapsibleIds.length > 0}
            onToggleRow={toggle}
            onExpandAll={() => setCollapsed(new Set())}
            onCollapseAll={() => setCollapsed(new Set(collapsibleIds))}
            onOpen={setOpenItemId}
            draggable={canMove}
            canReorderColumns={canConfigure}
            onAddSubtask={
              canCreate
                ? (parent) =>
                    // Sous-tâches et bugs se créent de la même façon sous une User Story.
                    setCreateContext({
                      parent,
                      types: childTypesOf(parent.type).filter((type) => CARD_TYPES.includes(type)),
                    })
                : undefined
            }
            onAddRowChild={
              canCreate
                ? (parent) =>
                    setCreateContext({
                      parent,
                      types: childTypesOf(parent.type).filter((type) => ROW_TYPES.includes(type)),
                    })
                : undefined
            }
          />
        </div>

        <DragOverlay>
          {draggedItem && (
            <div className="w-64 rotate-1 shadow-xl">
              <WorkItemCard item={draggedItem} onOpen={() => undefined} />
            </div>
          )}
          {draggedColumn && (
            <div className="card ring-accent-400 flex h-11 w-64 items-center gap-2 px-3 shadow-pop ring-2">
              <ColumnHeaderContent
                column={draggedColumn}
                count={draggedColumn.count}
                points={draggedColumn.points}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Formulaire de création unique : ticket libre, ou enfant du ticket d'une ligne. */}
      <CreateWorkItemDialog
        open={createContext !== null}
        onClose={() => setCreateContext(null)}
        projectRef={projectKey}
        candidates={tree ?? []}
        defaultType={createContext?.types[0] ?? WorkItemType.SUBTASK}
        allowedTypes={createContext?.types}
        defaultParentId={createContext?.parent.id ?? null}
        defaultStatus={WorkItemStatus.TODO}
        defaultSprintId={selectedSprint.id}
      />

      <WorkItemDetailPanel
        projectRef={projectKey}
        itemId={openItemId}
        onClose={() => setOpenItemId(null)}
      />

      <BoardColumnsConfigDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        projectKey={projectKey}
        columns={columns}
      />
    </div>
  );
}

/**
 * Colonne de destination et voisins d'une carte déposée. La cible est toujours
 * une colonne précise (identifiant), jamais un statut.
 */
function resolveDropTarget(
  columns: BoardColumn[],
  itemId: string,
  overId: string,
): { columnId: string; beforeId: string | null; afterId: string | null } | null {
  const droppedColumnId = parseColumnDropId(overId);
  if (droppedColumnId) {
    const items = (columns.find((column) => column.id === droppedColumnId)?.items ?? []).filter(
      (item) => item.id !== itemId,
    );
    return { columnId: droppedColumnId, beforeId: items.at(-1)?.id ?? null, afterId: null };
  }

  const targetColumn = columns.find((column) => column.items.some((item) => item.id === overId));
  if (!targetColumn) return null;

  const items = targetColumn.items.filter((item) => item.id !== itemId);
  const overIndex = items.findIndex((item) => item.id === overId);
  if (overIndex === -1) {
    return { columnId: targetColumn.id, beforeId: items.at(-1)?.id ?? null, afterId: null };
  }

  return {
    columnId: targetColumn.id,
    beforeId: overIndex > 0 ? (items[overIndex - 1]?.id ?? null) : null,
    afterId: overId,
  };
}

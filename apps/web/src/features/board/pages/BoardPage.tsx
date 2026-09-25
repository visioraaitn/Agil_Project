import { useEffect, useMemo, useState } from 'react';
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
import { ChevronDown, ChevronRight, Layers, Plus, SlidersHorizontal } from 'lucide-react';
import {
  LABELS_FR,
  Priority,
  WorkItemStatus,
  WorkItemType,
  type BoardColumn,
  type WorkItemSummary,
} from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateMessage';
import { useProjectMembers, useProjectPermissions } from '@/features/projects/hooks';
import { defaultSprintId, useSprints } from '@/features/sprints/hooks';
import { CreateWorkItemDialog } from '@/features/work-items/components/CreateWorkItemDialog';
import { FiltersBar } from '@/features/work-items/components/FiltersBar';
import { TypeIcon } from '@/features/work-items/components/WorkItemChrome';
import { WorkItemCard } from '@/features/work-items/components/WorkItemCard';
import { WorkItemDetailPanel } from '@/features/work-items/components/WorkItemDetailPanel';
import { useBacklog, useBoard, useMoveWorkItem } from '@/features/work-items/hooks';
import { useUrlWorkItemFilters } from '@/features/work-items/use-url-work-item-filters';
import { loadBoardConfig, type BoardConfig, type ColumnDefinition } from '../board-config';
import { BoardColumnsConfigDialog } from '../components/BoardColumnsConfigDialog';
import { buildHierarchyLanes } from '../hierarchy';

const COLUMN_PREFIX = 'column:';

type SwimlaneMode = 'none' | 'assignee' | 'epic' | 'priority' | 'hierarchy';

interface SwimlaneGroup {
  id: string;
  title: string;
  avatarUrl?: string | null;
  items: WorkItemSummary[];
}

/** D.1 · Task Board Kanban avec Swimlanes (couloirs), colonnes personnalisables et création rapide. */
export function BoardPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const [filters, setFilters] = useUrlWorkItemFilters();
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [swimlane, setSwimlane] = useState<SwimlaneMode>('none');
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
  const [boardConfig, setBoardConfig] = useState<BoardConfig>(() => loadBoardConfig(projectKey));

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

  const canMove = can('workitem:move');
  const canCreate = can('workitem:create');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const directory = useMemo(() => (members ?? []).map((member) => member.user), [members]);

  const visibleDefs = useMemo(
    () => boardConfig.columns.filter((c) => c.visible !== false),
    [boardConfig],
  );

  const allItems = useMemo(() => columns?.flatMap((column) => column.items) ?? [], [columns]);

  const draggedItem = useMemo(
    () => allItems.find((item) => item.id === draggedId) ?? null,
    [allItems, draggedId],
  );

  // Construction des groupes de couloirs (Swimlanes)
  const swimlaneGroups = useMemo<SwimlaneGroup[]>(() => {
    if (swimlane === 'none' || !columns) {
      return [{ id: 'all', title: 'Tous les tickets', items: allItems }];
    }

    if (swimlane === 'assignee') {
      const groups: SwimlaneGroup[] = directory.map((user) => ({
        id: `user-${user.id}`,
        title: user.name,
        avatarUrl: user.avatarUrl,
        items: allItems.filter((item) =>
          item.assignees.some((assignee) => assignee.id === user.id),
        ),
      }));

      const unassigned = allItems.filter((item) => item.assignees.length === 0);
      if (unassigned.length > 0) {
        groups.push({
          id: 'unassigned',
          title: 'Non assigné',
          items: unassigned,
        });
      }
      return groups.filter((g) => g.items.length > 0 || g.id !== 'unassigned');
    }

    if (swimlane === 'priority') {
      return [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW]
        .map((p) => ({
          id: `priority-${p}`,
          title: LABELS_FR.priority[p],
          items: allItems.filter((item) => item.priority === p),
        }))
        .filter((g) => g.items.length > 0);
    }

    if (swimlane === 'epic') {
      const epics = (tree ?? []).filter((node) => node.type === 'EPIC');
      const groups: SwimlaneGroup[] = epics.map((epic) => ({
        id: `epic-${epic.id}`,
        title: `${epic.key} · ${epic.title}`,
        items: allItems.filter((item) => item.parentId === epic.id || item.id === epic.id),
      }));

      const unassigned = allItems.filter(
        (item) => !epics.some((e) => e.id === item.parentId || e.id === item.id),
      );
      if (unassigned.length > 0) {
        groups.push({
          id: 'no-epic',
          title: 'Hors Epic',
          items: unassigned,
        });
      }
      return groups;
    }

    return [{ id: 'all', title: 'Tous les tickets', items: allItems }];
  }, [swimlane, columns, allItems, directory, tree]);

  // Couloirs Epic > Story/Bug du mode "Par hiérarchie" : construits séparément
  // de swimlaneGroups (logique de résolution d'ascendance différente).
  const hierarchyBoard = useMemo(
    () => buildHierarchyLanes(tree ?? [], allItems),
    [tree, allItems],
  );

  const toggleLane = (laneId: string) => {
    setCollapsedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneId)) next.delete(laneId);
      else next.add(laneId);
      return next;
    });
  };

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

  if (sprintsLoading || isLoading) return <LoadingState />;
  if (sprintsError || error) return <ErrorState error={sprintsError ?? error} />;
  if (!selectedSprint) {
    return (
      <div className="flex h-full flex-col">
        <header className="border-border-subtle border-b px-4 py-2">
          <h1 className="text-ink-900 text-xl font-semibold">Task Board</h1>
        </header>
        <EmptyState
          title={sprints && sprints.length > 0 ? 'Sélectionnez un sprint' : 'Aucun sprint'}
          description="Créez un sprint et affectez-y des User Stories pour alimenter le board."
        />
      </div>
    );
  }
  if (!columns) return null;

  return (
    <div className="flex h-full flex-col">
      <header className="border-border-subtle flex shrink-0 items-center gap-3 border-b px-4 py-2 flex-wrap">
        <h1 className="text-ink-900 text-xl font-semibold">Task Board</h1>
        <span className="text-ink-400 text-sm">
          {columns.reduce((total, column) => total + column.count, 0)} ticket(s)
        </span>
        <Select
          aria-label="Sélectionner un sprint"
          className="h-7 w-52 text-sm"
          value={selectedSprint.id}
          onChange={(event) => setSelectedSprintId(event.target.value)}
        >
          {(sprints ?? []).map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name} · {LABELS_FR.sprintStatus[sprint.status]}
            </option>
          ))}
        </Select>

        {/* Sélecteur de Swimlanes */}
        <div className="ml-4 flex items-center gap-1.5 text-xs text-ink-500 bg-surface-sunken px-2 py-1 rounded border border-border-subtle">
          <Layers className="size-3.5 text-accent-600" />
          <span className="font-semibold text-ink-700">Couloirs :</span>
          <select
            value={swimlane}
            onChange={(e) => setSwimlane(e.target.value as SwimlaneMode)}
            className="bg-surface text-ink-800 border-border-default h-6 rounded border px-1.5 text-xs font-medium focus:outline-none cursor-pointer"
          >
            <option value="none">Aucun (Standard)</option>
            <option value="assignee">Par Assigné</option>
            <option value="epic">Par Epic</option>
            <option value="priority">Par Priorité</option>
            <option value="hierarchy">Par hiérarchie</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!canMove && <span className="text-ink-400 text-xs">Lecture seule</span>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfigOpen(true)}
            className="text-ink-600 hover:text-ink-900 gap-1.5 h-8 px-2.5 text-xs"
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Colonnes</span>
          </Button>
        </div>
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
        <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          {swimlane === 'hierarchy' ? (
            /* Vue hiérarchique Epic > Story/Bug, chaque niveau repliable indépendamment */
            <>
              {hierarchyBoard.epics.map((epicLane) => {
                const epicLaneId = `epic:${epicLane.id}`;
                const epicCollapsed = collapsedLanes.has(epicLaneId);
                const epicItems = epicLane.stories.flatMap((story) => story.items);
                const epicPoints = epicItems.reduce((acc, it) => acc + (it.storyPoints ?? 0), 0);

                return (
                  <section
                    key={epicLane.id}
                    className="border-border-default bg-surface rounded border overflow-hidden shadow-xs"
                  >
                    <header
                      onClick={() => toggleLane(epicLaneId)}
                      className="bg-surface-muted hover:bg-surface-sunken border-border-subtle flex items-center gap-2 border-b px-3 py-2 cursor-pointer transition-colors"
                    >
                      {epicCollapsed ? (
                        <ChevronRight className="size-4 text-ink-500" />
                      ) : (
                        <ChevronDown className="size-4 text-ink-500" />
                      )}
                      {!epicLane.isNoEpic && <TypeIcon type={WorkItemType.EPIC} />}
                      <h2 className="text-ink-900 text-sm font-semibold truncate">
                        {epicLane.isNoEpic ? epicLane.title : `${epicLane.key} · ${epicLane.title}`}
                      </h2>
                      <span className="text-ink-400 text-xs font-medium">
                        ({epicItems.length} tickets · {epicPoints} pts)
                      </span>
                    </header>

                    {!epicCollapsed && (
                      <div className="flex flex-col gap-1.5 p-2.5 bg-surface-sunken/40">
                        {epicLane.stories.map((storyLane) => {
                          const storyLaneId = `story:${storyLane.id}`;
                          const storyCollapsed = collapsedLanes.has(storyLaneId);
                          const storyPoints = storyLane.items.reduce(
                            (acc, it) => acc + (it.storyPoints ?? 0),
                            0,
                          );

                          return (
                            <div
                              key={storyLane.id}
                              className="border-border-default bg-surface rounded border overflow-hidden"
                            >
                              <header
                                onClick={() => toggleLane(storyLaneId)}
                                className="hover:bg-surface-muted flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors"
                              >
                                {storyCollapsed ? (
                                  <ChevronRight className="size-3.5 text-ink-500" />
                                ) : (
                                  <ChevronDown className="size-3.5 text-ink-500" />
                                )}
                                <span className="text-ink-400 shrink-0 text-xs font-semibold">
                                  {storyLane.key}
                                </span>
                                <span className="text-ink-900 min-w-0 flex-1 truncate text-sm">
                                  {storyLane.title}
                                </span>
                                <span className="text-ink-400 text-xs font-medium">
                                  ({storyLane.items.length} · {storyPoints} pts)
                                </span>
                              </header>

                              {!storyCollapsed && (
                                <div className="flex gap-2.5 overflow-x-auto p-2 items-start border-t border-border-subtle bg-surface-sunken/40">
                                  {visibleDefs.map((def) => {
                                    const colItems = storyLane.items.filter(
                                      (it) => it.status === def.status,
                                    );
                                    return (
                                      <Column
                                        key={`${storyLane.id}-${def.id}`}
                                        columnDef={def}
                                        items={colItems}
                                        count={colItems.length}
                                        points={colItems.reduce(
                                          (acc, it) => acc + (it.storyPoints ?? 0),
                                          0,
                                        )}
                                        onOpen={setOpenItemId}
                                        draggable={canMove}
                                        canCreate={false}
                                        onOpenCreateDialog={() => setCreateDialogOpen(true)}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}

              {hierarchyBoard.unlinked.length > 0 && (
                <section className="border-border-default bg-surface rounded border overflow-hidden shadow-xs">
                  <header className="bg-surface-muted border-border-subtle flex items-center gap-2 border-b px-3 py-2">
                    <h2 className="text-ink-900 text-sm font-semibold">Éléments non liés</h2>
                    <span className="text-ink-400 text-xs font-medium">
                      ({hierarchyBoard.unlinked.length} tickets)
                    </span>
                  </header>
                  <div className="flex gap-2.5 overflow-x-auto p-2.5 items-start bg-surface-sunken/40">
                    {visibleDefs.map((def) => {
                      const colItems = hierarchyBoard.unlinked.filter(
                        (it) => it.status === def.status,
                      );
                      return (
                        <Column
                          key={`unlinked-${def.id}`}
                          columnDef={def}
                          items={colItems}
                          count={colItems.length}
                          points={colItems.reduce((acc, it) => acc + (it.storyPoints ?? 0), 0)}
                          onOpen={setOpenItemId}
                          draggable={canMove}
                          canCreate={false}
                          onOpenCreateDialog={() => setCreateDialogOpen(true)}
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {hierarchyBoard.epics.length === 0 && hierarchyBoard.unlinked.length === 0 && (
                <EmptyState
                  title="Aucun ticket"
                  description="Ce sprint ne contient encore aucune Story, Bug ou Sous-tâche."
                />
              )}
            </>
          ) : swimlane === 'none' ? (
            /* Vue classique en colonnes uniques */
            <div className="flex gap-2.5 overflow-x-auto items-start pb-2">
              {visibleDefs.map((def) => {
                const items = columns.find((c) => c.status === def.status)?.items ?? [];
                return (
                  <Column
                    key={def.id}
                    columnDef={def}
                    items={items}
                    count={items.length}
                    points={items.reduce((acc, it) => acc + (it.storyPoints ?? 0), 0)}
                    onOpen={setOpenItemId}
                    draggable={canMove}
                    canCreate={canCreate}
                    onOpenCreateDialog={() => setCreateDialogOpen(true)}
                  />
                );
              })}

              <button
                type="button"
                onClick={() => setConfigOpen(true)}
                className="border-border-default/60 hover:border-accent-400 hover:bg-surface text-ink-500 hover:text-ink-900 flex h-24 w-60 shrink-0 flex-col items-center justify-center gap-1.5 rounded border border-dashed text-xs font-medium transition-all"
              >
                <Plus className="size-4" />
                <span>Ajouter une colonne</span>
              </button>
            </div>
          ) : (
            /* Vue en Couloirs Horizontaux (Swimlanes) */
            swimlaneGroups.map((lane) => {
              const isCollapsed = collapsedLanes.has(lane.id);
              const lanePoints = lane.items.reduce((acc, it) => acc + (it.storyPoints ?? 0), 0);

              return (
                <section
                  key={lane.id}
                  className="border-border-default bg-surface rounded border overflow-hidden shadow-xs"
                >
                  <header
                    onClick={() => toggleLane(lane.id)}
                    className="bg-surface-muted hover:bg-surface-sunken border-border-subtle flex items-center gap-2 border-b px-3 py-2 cursor-pointer transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-4 text-ink-500" />
                    ) : (
                      <ChevronDown className="size-4 text-ink-500" />
                    )}
                    {lane.avatarUrl !== undefined && (
                      <Avatar name={lane.title} avatarUrl={lane.avatarUrl} />
                    )}
                    <h2 className="text-ink-900 text-sm font-semibold truncate">{lane.title}</h2>
                    <span className="text-ink-400 text-xs font-medium">
                      ({lane.items.length} tickets · {lanePoints} pts)
                    </span>
                  </header>

                  {!isCollapsed && (
                    <div className="flex gap-2.5 overflow-x-auto p-2.5 items-start bg-surface-sunken/40">
                      {visibleDefs.map((def) => {
                        const laneColItems = lane.items.filter((it) => it.status === def.status);
                        return (
                          <Column
                            key={`${lane.id}-${def.id}`}
                            columnDef={def}
                            items={laneColItems}
                            count={laneColItems.length}
                            points={laneColItems.reduce(
                              (acc, it) => acc + (it.storyPoints ?? 0),
                              0,
                            )}
                            onOpen={setOpenItemId}
                            draggable={canMove}
                            canCreate={canCreate && def.status === WorkItemStatus.TODO}
                            onOpenCreateDialog={() => setCreateDialogOpen(true)}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>

        <DragOverlay>
          {draggedItem && (
            <div className="w-64 rotate-1 shadow-xl">
              <WorkItemCard item={draggedItem} onOpen={() => undefined} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Formulaire complet de création de ticket */}
      <CreateWorkItemDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        projectRef={projectKey}
        candidates={tree ?? []}
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
        config={boardConfig}
        onChange={setBoardConfig}
      />
    </div>
  );
}

function Column({
  columnDef,
  items,
  count,
  points,
  onOpen,
  draggable,
  canCreate,
  onOpenCreateDialog,
}: {
  columnDef: ColumnDefinition;
  items: WorkItemSummary[];
  count: number;
  points: number;
  onOpen: (itemId: string) => void;
  draggable: boolean;
  canCreate: boolean;
  onOpenCreateDialog: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${columnDef.status}` });

  const wipLimit = columnDef.wipLimit ?? null;
  const isOverWip = wipLimit !== null && count > wipLimit;
  const isTodoColumn = columnDef.status === WorkItemStatus.TODO;

  return (
    <section className="flex w-64 shrink-0 flex-col">
      <header className="border-border-default bg-surface-muted flex items-center gap-2 rounded-t border border-b-0 px-2 py-1.5">
        <h2 className="text-ink-700 text-sm font-semibold truncate" title={columnDef.name}>
          {columnDef.name}
        </h2>
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            isOverWip ? 'bg-red-100 text-danger font-bold' : 'text-ink-400 bg-surface'
          }`}
        >
          {count}
          {wipLimit ? `/${wipLimit}` : ''}
        </span>
        {points > 0 && (
          <span className="text-ink-400 ml-auto text-xs font-medium">{points} pts</span>
        )}
      </header>

      <div
        ref={setNodeRef}
        className={`scrollbar-thin border-border-default flex min-h-28 flex-1 flex-col gap-1.5 overflow-y-auto rounded-b border p-1.5 ${
          isOver ? 'bg-accent-50/80 border-accent-300' : 'bg-surface-sunken'
        }`}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableCard key={item.id} item={item} onOpen={onOpen} disabled={!draggable} />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <p className="text-ink-400 py-4 text-center text-xs">Aucun ticket</p>
        )}

        {/* Bouton de création affiché UNIQUEMENT sur la colonne "À faire" */}
        {isTodoColumn && canCreate && (
          <button
            type="button"
            onClick={onOpenCreateDialog}
            className="text-ink-500 hover:text-ink-900 hover:bg-surface border-border-default/60 hover:border-border-default mt-auto flex w-full items-center justify-center gap-1.5 rounded border border-dashed py-2 px-3 text-xs font-medium transition-all cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Créer un ticket</span>
          </button>
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

  return {
    status: targetColumn.status,
    beforeId: overIndex > 0 ? (items[overIndex - 1]?.id ?? null) : null,
    afterId: overId,
  };
}

import { useMemo, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react';
import {
  LABELS_FR,
  WorkItemStatus,
  WorkItemType,
  type BacklogNode,
  type BoardColumn,
  type WorkItemSummary,
} from '@visiora/shared';
import { AvatarStack } from '@/components/common/AvatarStack';
import { EmptyState } from '@/components/common/StateMessage';
import { TicketKey, TypeIcon } from '@/features/work-items/components/WorkItemChrome';
import { STATUS_DOT } from '@/features/work-items/status-colors';
import { cn } from '@/lib/utils';
import { columnDropId, columnSortId } from '../board-dnd';
import { CARD_TYPES, ROW_TYPES, childTypesOf, type BoardRow } from '../hierarchy';
import { ColumnHeaderContent, SortableColumnHeader } from './ColumnHeader';
import { SortableCard } from './SortableCard';

/** Section de la grille : un couloir (Assigné, Epic, Priorité) ou le board entier. */
export interface BoardGridSection {
  id: string;
  /** Bandeau repliable du couloir ; absent quand la grille n'a qu'une section. */
  lane?: {
    title: string;
    icon: ReactNode;
    summary: string;
    collapsed: boolean;
    onToggle: () => void;
  };
  rows: BoardRow[];
}

interface BoardGridProps {
  /** Colonnes visibles, dans l'ordre d'affichage. */
  columns: BoardColumn[];
  sections: BoardGridSection[];
  hasCollapsible: boolean;
  onToggleRow: (rowId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onOpen: (itemId: string) => void;
  draggable: boolean;
  canReorderColumns: boolean;
  /** « + Sous-tâche / Bug » de la cellule « À faire » d'une ligne User Story. */
  onAddSubtask?: (parent: BacklogNode) => void;
  /** « + » de la cellule Work Items d'un Epic : nouvelle User Story. */
  onAddRowChild?: (parent: BacklogNode) => void;
}

/** Largeurs (px) : la colonne Work Items est fixe, les colonnes du workflow se partagent le reste. */
const WORK_ITEMS_WIDTH = 248;
const MIN_STATUS_WIDTH = 168;

const WORK_ITEMS_CELL =
  'bg-surface sticky left-0 z-10 w-[248px] shrink-0 border-r border-border-default';
/**
 * Colonnes fluides : le board tient dans la largeur de l'écran. En dessous de
 * MIN_STATUS_WIDTH par colonne (beaucoup de colonnes personnalisées), il défile.
 */
const STATUS_CELL = 'min-w-[168px] flex-1 basis-0 border-r border-border-subtle last:border-r-0';
/** Fond lavande très léger de la cellule Work Items d'un Epic. */
const EPIC_ROW_BG = 'bg-[color-mix(in_srgb,var(--color-purple)_6%,var(--color-surface))]';
/** Retrait par niveau dans la cellule Work Items — les colonnes, elles, ne bougent jamais. */
const INDENT = 20;
const CELL_PADDING = 12;
/** Axe vertical des connecteurs : centre du chevron (20 px de large). */
const GUIDE_OFFSET = CELL_PADDING + 9;
/** Hauteur où le connecteur rejoint le contenu de la ligne (milieu de la première ligne de texte). */
const CONNECTOR_TOP = 22;

const sumPoints = (items: WorkItemSummary[]) =>
  items.reduce((total, item) => total + (item.storyPoints ?? 0), 0);

/**
 * D.1 · Task Board en grille : la colonne « Work Items » porte un Epic, une
 * User Story ou un Bug par ligne ; les colonnes du workflow portent ses
 * Sous-tâches, chacune dans la colonne que le serveur lui attribue. La même
 * grille sert à tous les couloirs : ils en sont des sections.
 */
export function BoardGrid({
  columns,
  sections,
  hasCollapsible,
  onToggleRow,
  onExpandAll,
  onCollapseAll,
  onOpen,
  draggable,
  canReorderColumns,
  onAddSubtask,
  onAddRowChild,
}: BoardGridProps) {
  // Une carte appartient à une seule colonne : celle où le serveur l'a rangée.
  const columnOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const column of columns) for (const item of column.items) map.set(item.id, column.id);
    return map;
  }, [columns]);

  // Les nouvelles sous-tâches naissent « À faire » : le bouton vit dans cette colonne.
  const todoColumnId =
    columns.find((column) => column.isDefault && column.status === WorkItemStatus.TODO)?.id ??
    columns.find((column) => column.status === WorkItemStatus.TODO)?.id;

  if (sections.every((section) => section.rows.length === 0 && !section.lane)) {
    return (
      <div className="card">
        <EmptyState
          title="Aucun work item"
          description="Affectez des User Stories à ce sprint pour alimenter le board."
        />
      </div>
    );
  }

  return (
    <div
      className="card w-full overflow-clip"
      style={{ minWidth: WORK_ITEMS_WIDTH + columns.length * MIN_STATUS_WIDTH }}
    >
      <div className="bg-surface-muted border-border-default sticky top-0 z-20 flex border-b">
        <div
          className={cn(WORK_ITEMS_CELL, 'bg-surface-muted z-30 flex h-11 items-center gap-1 px-3')}
        >
          <h2 className="text-ink-900 flex-1 text-base font-semibold">Work Items</h2>
          {hasCollapsible && (
            <>
              <IconButton label="Tout déplier" onClick={onExpandAll}>
                <ChevronsUpDown className="size-3.5" />
              </IconButton>
              <IconButton label="Tout replier" onClick={onCollapseAll}>
                <ChevronsDownUp className="size-3.5" />
              </IconButton>
            </>
          )}
        </div>
        <SortableContext
          items={columns.map((column) => columnSortId(column.id))}
          strategy={horizontalListSortingStrategy}
        >
          {columns.map((column) => (
            <SortableColumnHeader
              key={column.id}
              column={column}
              disabled={!canReorderColumns}
              className={cn(STATUS_CELL, 'bg-surface-muted flex h-11 items-center gap-2 px-3')}
            >
              {(handle) => (
                <ColumnHeaderContent
                  column={column}
                  count={column.count}
                  points={column.points}
                  dragHandle={handle}
                />
              )}
            </SortableColumnHeader>
          ))}
        </SortableContext>
      </div>

      {sections.map((section) => (
        <div key={section.id}>
          {section.lane && <LaneBand lane={section.lane} />}
          {!section.lane?.collapsed &&
            section.rows.map((row) => (
              <div
                key={row.rowId}
                data-row-id={row.rowId}
                className="border-border-subtle flex border-b last:border-b-0"
              >
                <div
                  className={cn(
                    WORK_ITEMS_CELL,
                    row.kind === 'work-item' && row.item.type === WorkItemType.EPIC && EPIC_ROW_BG,
                  )}
                >
                  <WorkItemsCell
                    row={row}
                    onToggleRow={onToggleRow}
                    onOpen={onOpen}
                    onAddRowChild={onAddRowChild}
                  />
                </div>
                {columns.map((column) => (
                  <CardCell
                    key={column.id}
                    columnId={column.id}
                    dropId={columnDropId(column.id, row.rowId)}
                    items={row.cards.filter((item) => columnOf.get(item.id) === column.id)}
                    onOpen={onOpen}
                    draggable={draggable}
                    onAddSubtask={
                      // Seule une User Story porte des cartes : pas de bouton sur un Epic.
                      onAddSubtask &&
                      row.kind === 'work-item' &&
                      column.id === todoColumnId &&
                      childTypesOf(row.item.type).some((type) => CARD_TYPES.includes(type))
                        ? () => onAddSubtask(row.item)
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

function LaneBand({ lane }: { lane: NonNullable<BoardGridSection['lane']> }) {
  return (
    <div className="bg-surface-muted border-border-default border-b">
      <button
        type="button"
        onClick={lane.onToggle}
        aria-expanded={!lane.collapsed}
        className="hover:bg-surface-sunken sticky left-0 flex w-max max-w-[100vw] items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
      >
        {lane.collapsed ? (
          <ChevronRight className="text-ink-500 size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-ink-500 size-4 shrink-0" />
        )}
        {lane.icon}
        <span className="text-ink-900 truncate text-base font-semibold">{lane.title}</span>
        <span className="text-ink-500 shrink-0 text-sm">{lane.summary}</span>
      </button>
    </div>
  );
}

/** Traits de hiérarchie : prolongements des ancêtres et « └ » de la ligne. */
function Connectors({ row }: { row: BoardRow }) {
  // Parent déplié : un trait descend de son chevron vers ses lignes enfants.
  const hasVisibleChildren = row.kind === 'work-item' && row.hasChildRows && !row.collapsed;
  if (row.depth === 0 && !hasVisibleChildren) return null;
  const ownLeft = GUIDE_OFFSET + (row.depth - 1) * INDENT;

  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0">
      {row.guides.map((continues, level) =>
        continues ? (
          <span
            key={level}
            className="bg-border-strong absolute inset-y-0 w-px"
            style={{ left: GUIDE_OFFSET + level * INDENT }}
          />
        ) : null,
      )}
      {row.depth > 0 && (
        <>
          <span
            className="bg-border-strong absolute top-0 w-px"
            style={{ left: ownLeft, height: row.isLast ? CONNECTOR_TOP : '100%' }}
          />
          <span
            className="bg-border-strong absolute h-px"
            style={{ left: ownLeft, top: CONNECTOR_TOP, width: INDENT - 6 }}
          />
        </>
      )}
      {hasVisibleChildren && (
        <span
          className="bg-border-strong absolute bottom-0 w-px"
          style={{ left: GUIDE_OFFSET + row.depth * INDENT, top: CONNECTOR_TOP + 8 }}
        />
      )}
    </span>
  );
}

function WorkItemsCell({
  row,
  onToggleRow,
  onOpen,
  onAddRowChild,
}: {
  row: BoardRow;
  onToggleRow: (rowId: string) => void;
  onOpen: (itemId: string) => void;
  onAddRowChild?: BoardGridProps['onAddRowChild'];
}) {
  if (row.kind === 'unlinked') {
    return (
      <div className="flex h-full items-start gap-1.5 px-3 py-2.5">
        <span className="size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <span className="text-ink-900 text-base font-semibold">Sans user story</span>
          <span className="text-ink-500 mt-0.5 block text-xs">{subtaskSummary(row.cards)}</span>
        </div>
      </div>
    );
  }

  const { item } = row;
  const isEpic = item.type === WorkItemType.EPIC;
  // Le « + » de la cellule crée une ligne enfant (User Story sous un Epic) ;
  // sous-tâches et bugs s'ajoutent depuis la colonne « À faire ».
  const rowChildTypes = childTypesOf(item.type).filter((type) => ROW_TYPES.includes(type));

  return (
    <div
      className="group/row relative flex h-full items-start gap-1.5 py-2.5 pr-2"
      style={{ paddingLeft: CELL_PADDING + row.depth * INDENT }}
    >
      <Connectors row={row} />
      {row.hasChildRows ? (
        <Chevron
          expanded={!row.collapsed}
          label={`${row.collapsed ? 'Déplier' : 'Replier'} ${LABELS_FR.workItemType[item.type]} ${item.key}`}
          onToggle={() => onToggleRow(row.rowId)}
        />
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}
      <TypeIcon type={item.type} boxed={isEpic} className={isEpic ? undefined : 'mt-0.5'} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(item.id)}
          title={`${item.key} · ${item.title}`}
          className="group flex w-full min-w-0 flex-col text-left"
        >
          <TicketKey value={item.key} className={isEpic ? 'text-purple' : undefined} />
          <span
            className={cn(
              'text-ink-900 group-hover:text-accent-700 mt-0.5 line-clamp-2 leading-snug',
              isEpic ? 'text-base font-semibold' : 'text-sm font-medium',
            )}
          >
            {item.title}
          </span>
        </button>
        <div className="mt-1.5 flex items-start gap-2">
          <p className="text-ink-500 min-w-0 flex-1 text-xs leading-relaxed">
            <span className="text-ink-600 mr-1 inline-flex items-center gap-1 whitespace-nowrap">
              <span className={cn('size-1.5 rounded-full', STATUS_DOT[item.status])} />
              {LABELS_FR.workItemStatus[item.status]}
            </span>
            · {isEpic ? storySummary(item) : subtaskSummary(row.cards)}
          </p>
          {item.assignees.length > 0 && (
            <span className="shrink-0">
              <AvatarStack users={item.assignees} limit={2} />
            </span>
          )}
        </div>
      </div>
      {onAddRowChild && rowChildTypes.length > 0 && (
        <button
          type="button"
          onClick={() => onAddRowChild(item)}
          aria-label={`Ajouter ${rowChildTypes.map((type) => LABELS_FR.workItemType[type]).join(' ou ')} sous ${item.key}`}
          title={`Ajouter ${rowChildTypes.map((type) => LABELS_FR.workItemType[type]).join(' / ')}`}
          className="text-ink-400 hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-accent-500 flex size-6 shrink-0 items-center justify-center rounded-md opacity-70 transition group-hover/row:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Plus className="size-3.5" strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}

/** Un Epic ne porte pas de cartes : on résume ses User Stories (« 1/3 user stories terminées »). */
function storySummary(epic: BacklogNode): string {
  const stories = epic.children.filter((child) => child.type === WorkItemType.STORY);
  if (stories.length === 0) return 'aucune user story';
  const done = stories.filter((story) => story.status === WorkItemStatus.DONE).length;
  return `${done}/${stories.length} user stor${stories.length > 1 ? 'ies' : 'y'} terminée${done > 1 ? 's' : ''}`;
}

/** Avancement des cartes d'une ligne : « 2/3 sous-tâches · 1 bug · 8 pts ». */
function subtaskSummary(cards: WorkItemSummary[]): string {
  if (cards.length === 0) return 'aucune sous-tâche';
  const done = cards.filter((card) => card.status === WorkItemStatus.DONE).length;
  const subtasks = cards.filter((card) => card.type === WorkItemType.SUBTASK).length;
  const bugs = cards.filter((card) => card.type === WorkItemType.BUG).length;
  const parts = [
    subtasks > 0 ? `${subtasks} sous-tâche${subtasks > 1 ? 's' : ''}` : null,
    bugs > 0 ? `${bugs} bug${bugs > 1 ? 's' : ''}` : null,
  ].filter(Boolean);
  return `${done}/${cards.length} terminé${done > 1 ? 's' : ''} · ${parts.join(' · ')} · ${sumPoints(cards)} pts`;
}

function Chevron({
  expanded,
  label,
  onToggle,
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={label}
      title={label}
      onClick={(event) => {
        // Le chevron ne fait que replier/déplier : il n'ouvre jamais le détail.
        event.stopPropagation();
        onToggle();
      }}
      className="text-ink-500 hover:bg-surface-sunken hover:text-ink-900 relative z-10 flex size-5 shrink-0 items-center justify-center rounded-md"
    >
      {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="text-ink-500 hover:bg-surface-sunken hover:text-ink-900 flex size-6 items-center justify-center rounded"
    >
      {children}
    </button>
  );
}

function CardCell({
  columnId,
  dropId,
  items,
  onOpen,
  draggable,
  onAddSubtask,
}: {
  columnId: string;
  dropId: string;
  items: WorkItemSummary[];
  onOpen: (itemId: string) => void;
  draggable: boolean;
  onAddSubtask?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId, data: { kind: 'cell' } });

  return (
    <div
      ref={setNodeRef}
      data-column-id={columnId}
      className={cn(
        STATUS_CELL,
        'flex min-h-20 flex-col gap-2 p-2 transition-colors',
        isOver ? 'bg-accent-50/80' : 'bg-surface',
      )}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableCard key={item.id} item={item} onOpen={onOpen} disabled={!draggable} />
        ))}
      </SortableContext>
      {onAddSubtask && (
        <button
          type="button"
          onClick={onAddSubtask}
          className="text-ink-500 hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-accent-500 mt-auto inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Plus className="size-3.5" strokeWidth={2.25} />
          Sous-tâche / Bug
        </button>
      )}
    </div>
  );
}

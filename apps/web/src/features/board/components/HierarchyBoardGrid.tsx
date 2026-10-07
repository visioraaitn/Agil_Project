import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react';
import {
  LABELS_FR,
  WorkItemStatus,
  WorkItemType,
  type BoardColumn,
  type WorkItemSummary,
} from '@visiora/shared';
import { EmptyState } from '@/components/common/StateMessage';
import { TypeIcon } from '@/features/work-items/components/WorkItemChrome';
import { cn } from '@/lib/utils';
import type { ColumnDefinition } from '../board-config';
import { columnDropId } from '../board-dnd';
import type { HierarchyRow } from '../hierarchy';
import { SortableCard } from './SortableCard';

interface HierarchyBoardGridProps {
  rows: HierarchyRow[];
  columns: BoardColumn[];
  columnDefs: ColumnDefinition[];
  /** true si au moins une ligne peut être repliée. */
  hasCollapsible: boolean;
  onToggleRow: (rowId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onOpen: (itemId: string) => void;
  draggable: boolean;
  canCreate: boolean;
  onOpenCreateDialog: () => void;
}

const WORK_ITEMS_CELL = 'bg-surface sticky left-0 z-10 w-72 shrink-0 border-r border-border-default';
const STATUS_CELL = 'w-64 shrink-0 border-r border-border-subtle last:border-r-0';

const sumPoints = (items: WorkItemSummary[]) =>
  items.reduce((total, item) => total + (item.storyPoints ?? 0), 0);

/**
 * D.1 · Board hiérarchique façon Azure DevOps : une première colonne « Work Items »
 * porte la hiérarchie réelle (Epic > Story/Bug), les colonnes de statut portent le
 * workflow. Chaque carte reste dans la colonne de son propre statut, alignée sur la
 * ligne de son parent.
 */
export function HierarchyBoardGrid({
  rows,
  columns,
  columnDefs,
  hasCollapsible,
  onToggleRow,
  onExpandAll,
  onCollapseAll,
  onOpen,
  draggable,
  canCreate,
  onOpenCreateDialog,
}: HierarchyBoardGridProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Aucun ticket"
        description="Ce sprint ne contient encore aucune Story, Bug ou Sous-tâche."
      />
    );
  }

  return (
    <div className="border-border-default bg-surface w-max min-w-full rounded border shadow-xs">
      <div className="bg-surface-muted border-border-default sticky top-0 z-20 flex border-b">
        <div
          className={cn(WORK_ITEMS_CELL, 'bg-surface-muted z-30 flex items-center gap-1 px-2 py-1.5')}
        >
          <h2 className="text-ink-700 flex-1 text-sm font-semibold">Work Items</h2>
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
        {columnDefs.map((def) => (
          <ColumnHeader
            key={def.id}
            columnDef={def}
            column={columns.find((column) => column.status === def.status)}
            canCreate={canCreate && def.status === WorkItemStatus.TODO}
            onOpenCreateDialog={onOpenCreateDialog}
          />
        ))}
      </div>

      {rows.map((row) => (
        <div key={row.rowId} className="border-border-subtle flex border-b last:border-b-0">
          <div className={cn(WORK_ITEMS_CELL, row.kind === 'epic' && 'bg-surface-muted')}>
            <WorkItemsCell row={row} onToggleRow={onToggleRow} onOpen={onOpen} />
          </div>
          {columnDefs.map((def) =>
            row.kind === 'epic' ? (
              <div key={def.id} className={cn(STATUS_CELL, 'bg-surface-muted')} />
            ) : (
              <CardCell
                key={def.id}
                dropId={columnDropId(def.status, row.rowId)}
                items={row.cards.filter((item) => item.status === def.status)}
                onOpen={onOpen}
                draggable={draggable}
              />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function WorkItemsCell({
  row,
  onToggleRow,
  onOpen,
}: {
  row: HierarchyRow;
  onToggleRow: (rowId: string) => void;
  onOpen: (itemId: string) => void;
}) {
  if (row.kind === 'unlinked') {
    return (
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="text-ink-900 text-sm font-semibold">Éléments non liés</span>
        <Counts count={row.cards.length} points={sumPoints(row.cards)} />
      </div>
    );
  }

  if (row.kind === 'epic') {
    const { lane } = row;
    return (
      <div className="flex items-start gap-1.5 px-2 py-2">
        <Chevron
          expanded={!row.collapsed}
          label={`${row.collapsed ? 'Déplier' : 'Replier'} ${lane.isNoEpic ? lane.title : `Epic ${lane.key}`}`}
          onToggle={() => onToggleRow(row.rowId)}
        />
        {!lane.isNoEpic && <TypeIcon type={WorkItemType.EPIC} className="mt-0.5" />}
        <div className="min-w-0 flex-1">
          {lane.isNoEpic ? (
            <span className="text-ink-700 text-sm font-semibold">{lane.title}</span>
          ) : (
            <ItemTitle itemKey={lane.key} title={lane.title} strong onOpen={() => onOpen(lane.id)} />
          )}
          <Counts count={row.descendants.length} points={sumPoints(row.descendants)} />
        </div>
      </div>
    );
  }

  const { lane } = row;
  const typeLabel = LABELS_FR.workItemType[lane.type];
  return (
    <div className="flex items-start gap-1.5 py-2 pr-2 pl-6">
      {row.hasChildren ? (
        <Chevron
          expanded={!row.collapsed}
          label={`${row.collapsed ? 'Déplier' : 'Replier'} ${typeLabel} ${lane.key}`}
          onToggle={() => onToggleRow(row.rowId)}
        />
      ) : (
        <span className="size-5 shrink-0" aria-hidden />
      )}
      <TypeIcon type={lane.type} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <ItemTitle itemKey={lane.key} title={lane.title} onOpen={() => onOpen(lane.id)} />
        <Counts count={lane.items.length} points={sumPoints(lane.items)} />
      </div>
    </div>
  );
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
      className="text-ink-500 hover:bg-surface-sunken hover:text-ink-900 flex size-5 shrink-0 items-center justify-center rounded"
    >
      {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
    </button>
  );
}

function ItemTitle({
  itemKey,
  title,
  strong,
  onOpen,
}: {
  itemKey: string;
  title: string;
  strong?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${itemKey} · ${title}`}
      className="group flex w-full min-w-0 flex-col text-left"
    >
      <span className="text-ink-400 text-xs font-semibold">{itemKey}</span>
      <span
        className={cn(
          'text-ink-900 group-hover:text-accent-700 line-clamp-2 text-sm leading-snug',
          strong ? 'font-semibold' : 'font-medium',
        )}
      >
        {title}
      </span>
    </button>
  );
}

function Counts({ count, points }: { count: number; points: number }) {
  return (
    <span className="text-ink-400 text-xs font-medium">
      {count} ticket(s) · {points} pts
    </span>
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

function ColumnHeader({
  columnDef,
  column,
  canCreate,
  onOpenCreateDialog,
}: {
  columnDef: ColumnDefinition;
  column: BoardColumn | undefined;
  canCreate: boolean;
  onOpenCreateDialog: () => void;
}) {
  const count = column?.count ?? 0;
  const points = column?.points ?? 0;
  const wipLimit = columnDef.wipLimit ?? null;
  const isOverWip = wipLimit !== null && count > wipLimit;

  return (
    <div className={cn(STATUS_CELL, 'flex items-center gap-2 px-2 py-1.5')}>
      <h2 className="text-ink-700 truncate text-sm font-semibold" title={columnDef.name}>
        {columnDef.name}
      </h2>
      <span
        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
          isOverWip ? 'text-danger bg-red-100 font-bold' : 'text-ink-400 bg-surface'
        }`}
      >
        {count}
        {wipLimit ? `/${wipLimit}` : ''}
      </span>
      {points > 0 && <span className="text-ink-400 ml-auto text-xs font-medium">{points} pts</span>}
      {canCreate && (
        <button
          type="button"
          aria-label="Créer un ticket"
          title="Créer un ticket"
          onClick={onOpenCreateDialog}
          className={cn(
            'text-ink-500 hover:bg-surface hover:text-ink-900 flex size-6 shrink-0 items-center justify-center rounded',
            points > 0 ? '' : 'ml-auto',
          )}
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function CardCell({
  dropId,
  items,
  onOpen,
  draggable,
}: {
  dropId: string;
  items: WorkItemSummary[];
  onOpen: (itemId: string) => void;
  draggable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        STATUS_CELL,
        'flex min-h-14 flex-col gap-1.5 p-1.5',
        isOver ? 'bg-accent-50/80' : 'bg-surface-sunken/40',
      )}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableCard key={item.id} item={item} onOpen={onOpen} disabled={!draggable} />
        ))}
      </SortableContext>
    </div>
  );
}

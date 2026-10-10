import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus } from 'lucide-react';
import type { BoardColumnConfig } from '@visiora/shared';
import { STATUS_DOT } from '@/features/work-items/status-colors';
import { cn } from '@/lib/utils';
import { columnSortId, type BoardDragData } from '../board-dnd';

/** Contenu d'en-tête de colonne : poignée, puce de statut, nom, compteur (limite WIP) et points. */
export function ColumnHeaderContent({
  column,
  count,
  points,
  onCreate,
  dragHandle,
}: {
  column: BoardColumnConfig;
  count: number;
  points: number;
  onCreate?: () => void;
  dragHandle?: ReactNode;
}) {
  const wipLimit = column.wipLimit ?? null;
  const isOverWip = wipLimit !== null && count > wipLimit;

  return (
    <>
      {dragHandle}
      <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[column.status])} />
      <h2 className="text-ink-900 truncate text-base font-semibold" title={column.name}>
        {column.name}
      </h2>
      <span
        className={cn(
          'rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums',
          isOverWip
            ? 'text-danger bg-red-100 dark:bg-red-950/50'
            : 'bg-surface-sunken text-ink-500',
        )}
        title={wipLimit ? `Limite WIP : ${wipLimit}` : undefined}
      >
        {count}
        {wipLimit ? `/${wipLimit}` : ''}
      </span>
      {points > 0 && (
        <span className="text-ink-500 ml-auto text-xs font-medium whitespace-nowrap tabular-nums">
          {points} pts
        </span>
      )}
      {onCreate && (
        <button
          type="button"
          aria-label="Créer un ticket"
          title="Créer un ticket"
          onClick={onCreate}
          className={cn(
            'text-ink-500 hover:bg-surface-sunken hover:text-ink-900 flex size-6 shrink-0 items-center justify-center rounded-md',
            points > 0 ? '' : 'ml-auto',
          )}
        >
          <Plus className="size-3.5" strokeWidth={2} />
        </button>
      )}
    </>
  );
}

/**
 * En-tête de colonne réordonnable par glisser-déposer horizontal. Seule la
 * poignée démarre le glissement : un clic ailleurs (bouton « + ») reste un clic,
 * et les cartes gardent leur propre glisser-déposer.
 */
export function SortableColumnHeader({
  column,
  disabled,
  className,
  children,
}: {
  column: BoardColumnConfig;
  disabled: boolean;
  className?: string;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnSortId(column.id),
    data: { kind: 'column' } satisfies BoardDragData,
    disabled,
  });

  const handle = disabled ? null : (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Réordonner la colonne ${column.name}`}
      title="Glisser pour réordonner la colonne"
      className="text-ink-400 hover:bg-surface-sunken hover:text-ink-700 focus-visible:ring-accent-500 -ml-1 flex size-5 shrink-0 cursor-grab items-center justify-center rounded focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
    >
      <GripVertical className="size-3.5" strokeWidth={2} />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      data-column-header={column.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        className,
        isDragging && 'ring-accent-400 bg-accent-50 relative z-30 opacity-80 shadow-pop ring-2',
      )}
    >
      {children(handle)}
    </div>
  );
}

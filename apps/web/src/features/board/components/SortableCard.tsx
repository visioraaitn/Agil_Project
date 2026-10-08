import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WorkItemSummary } from '@visiora/shared';
import { WorkItemCard } from '@/features/work-items/components/WorkItemCard';

/** Carte du board déplaçable : l'identifiant dnd-kit est l'id du ticket. */
export function SortableCard({
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

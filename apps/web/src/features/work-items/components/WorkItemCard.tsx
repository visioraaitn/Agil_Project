import { forwardRef } from 'react';
import { AlertTriangle, GripVertical } from 'lucide-react';
import type { WorkItemSummary } from '@visiora/shared';
import { Avatar } from '@/components/common/Avatar';
import { cn } from '@/lib/utils';
import { LabelChips, PriorityBadge, StoryPoints, TypeIcon } from './WorkItemChrome';

interface WorkItemCardProps {
  item: WorkItemSummary;
  onOpen: (itemId: string) => void;
  /** Style appliqué pendant le glissement. */
  dragging?: boolean;
  style?: React.CSSProperties;
  dragHandleProps?: Record<string, unknown>;
}

/** D.1 · Carte du Task Board. */
export const WorkItemCard = forwardRef<HTMLDivElement, WorkItemCardProps>(function WorkItemCard(
  { item, onOpen, dragging, style, dragHandleProps },
  ref,
) {
  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        'border-border-default bg-surface hover:border-accent-300 rounded border p-2 shadow-sm',
        item.isBlocked && 'border-l-danger border-l-2',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-1.5">
        {dragHandleProps && (
          <button
            type="button"
            {...dragHandleProps}
            aria-label={`Déplacer ${item.key}`}
            className="text-ink-400 hover:text-ink-700 focus-visible:ring-accent-500 mt-0.5 cursor-grab rounded focus-visible:ring-2 focus-visible:outline-none"
          >
            <GripVertical className="size-3.5" strokeWidth={1.75} />
          </button>
        )}
        <TypeIcon type={item.type} className="mt-0.5" />
        <button
          type="button"
          onClick={() => onOpen(item.id)}
          className="text-ink-900 hover:text-accent-700 min-w-0 flex-1 text-left text-base leading-snug hover:underline"
        >
          {item.title}
        </button>
        <StoryPoints points={item.storyPoints} />
      </div>

      <LabelChips labels={item.labels} />

      {item.isBlocked && (
        <p className="text-danger mt-1 flex items-start gap-1 text-xs">
          <AlertTriangle className="mt-px size-3 shrink-0" strokeWidth={2} />
          {item.blockedReason ?? 'Bloqué'}
        </p>
      )}

      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-ink-400 text-xs font-semibold">{item.key}</span>
        <PriorityBadge priority={item.priority} />
        {item.childCount > 0 && (
          <span className="text-ink-400 text-xs">
            {item.doneChildCount}/{item.childCount}
          </span>
        )}
        <span className="ml-auto">
          {item.assignee ? (
            <Avatar name={item.assignee.name} avatarUrl={item.assignee.avatarUrl} />
          ) : (
            <span className="border-border-strong text-ink-400 flex size-6 items-center justify-center rounded-full border border-dashed text-xs">
              ?
            </span>
          )}
        </span>
      </div>
    </div>
  );
});

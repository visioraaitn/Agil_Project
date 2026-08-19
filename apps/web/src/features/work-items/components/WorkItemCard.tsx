import { forwardRef } from 'react';
import { AlertTriangle } from 'lucide-react';
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

/** D.1 · Carte du Task Board style Jira (déplaçable depuis toute la surface). */
export const WorkItemCard = forwardRef<HTMLDivElement, WorkItemCardProps>(function WorkItemCard(
  { item, onOpen, dragging, style, dragHandleProps },
  ref,
) {
  return (
    <div
      ref={ref}
      style={style}
      {...dragHandleProps}
      onClick={() => onOpen(item.id)}
      className={cn(
        'group border-border-default bg-surface hover:border-accent-400 hover:shadow-md rounded border p-2.5 shadow-sm transition-all duration-150 select-none',
        dragHandleProps ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        item.isBlocked && 'border-l-danger border-l-3',
        dragging && 'opacity-40 shadow-lg ring-2 ring-accent-500',
      )}
    >
      <div className="flex items-start gap-1.5">
        <TypeIcon type={item.type} className="mt-0.5 shrink-0" />
        <span className="text-ink-900 group-hover:text-accent-700 min-w-0 flex-1 text-left text-base leading-snug font-medium transition-colors">
          {item.title}
        </span>
        <StoryPoints points={item.storyPoints} />
      </div>

      <LabelChips labels={item.labels} />

      {item.isBlocked && (
        <p className="text-danger mt-1 flex items-start gap-1 text-xs">
          <AlertTriangle className="mt-px size-3 shrink-0" strokeWidth={2} />
          {item.blockedReason ?? 'Bloqué'}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <span className="text-ink-400 text-xs font-semibold">{item.key}</span>
        <PriorityBadge priority={item.priority} />
        {item.childCount > 0 && (
          <span className="text-ink-400 text-xs font-medium">
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


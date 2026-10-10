import { forwardRef } from 'react';
import { AlertTriangle, CheckSquare } from 'lucide-react';
import type { WorkItemSummary } from '@visiora/shared';
import { AvatarStack } from '@/components/common/AvatarStack';
import { cn } from '@/lib/utils';
import {
  LabelChips,
  PriorityBadge,
  StoryPoints,
  TagChips,
  TicketKey,
  TypeIcon,
} from './WorkItemChrome';

interface WorkItemCardProps {
  item: WorkItemSummary;
  onOpen: (itemId: string) => void;
  /** Style appliqué pendant le glissement. */
  dragging?: boolean;
  style?: React.CSSProperties;
  dragHandleProps?: Record<string, unknown>;
}

/** D.1 · Carte du Task Board (déplaçable depuis toute la surface). */
export const WorkItemCard = forwardRef<HTMLDivElement, WorkItemCardProps>(function WorkItemCard(
  { item, onOpen, dragging, style, dragHandleProps },
  ref,
) {
  const hasChips = (item.tags?.length ?? 0) > 0 || (item.labels?.length ?? 0) > 0;

  return (
    <div
      ref={ref}
      style={style}
      {...dragHandleProps}
      onClick={() => onOpen(item.id)}
      className={cn(
        'group bg-surface rounded-[10px] border p-3 shadow-raised transition-all duration-150 select-none hover:shadow-md',
        item.isBlocked
          ? 'border-red-200 hover:border-red-300 dark:border-red-900/60'
          : 'border-border-default hover:border-accent-300',
        dragHandleProps ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        dragging && 'opacity-40 shadow-lg ring-2 ring-accent-500',
      )}
    >
      <div className="flex items-center gap-1.5">
        <TypeIcon type={item.type} />
        <TicketKey value={item.key} className="min-w-0 flex-1 truncate" />
        <StoryPoints points={item.storyPoints} />
      </div>

      <p className="text-ink-900 group-hover:text-accent-700 mt-1.5 text-left text-base leading-snug font-semibold transition-colors">
        {item.title}
      </p>

      {hasChips && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <TagChips tags={item.tags} />
          <LabelChips labels={item.labels} />
        </div>
      )}

      {item.isBlocked && (
        <p className="text-danger mt-2.5 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs leading-relaxed dark:bg-red-950/40">
          <AlertTriangle className="mt-px size-3.5 shrink-0" strokeWidth={2} />
          <span>
            <span className="font-semibold">Bloqué</span>
            {item.blockedReason ? ` · ${item.blockedReason}` : ''}
          </span>
        </p>
      )}

      <div className="border-border-subtle mt-3 flex items-center gap-2 border-t pt-2.5">
        <PriorityBadge priority={item.priority} />
        {item.childCount > 0 && (
          <span
            className="text-ink-500 inline-flex items-center gap-1 text-xs font-medium"
            title="Sous-tâches terminées"
          >
            <CheckSquare className="size-3" strokeWidth={2} />
            {item.doneChildCount}/{item.childCount}
          </span>
        )}
        <span className="text-ink-500 min-w-0 flex-1 truncate text-xs" title={item.reporter.name}>
          Créé par {item.reporter.name}
        </span>
        <AvatarStack users={item.assignees} />
      </div>
    </div>
  );
});

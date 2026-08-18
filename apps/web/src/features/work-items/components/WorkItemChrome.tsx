import { Bug, BookOpen, CheckSquare, Crown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LABELS_FR, Priority, WorkItemStatus, WorkItemType } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<WorkItemType, LucideIcon> = {
  [WorkItemType.EPIC]: Crown,
  [WorkItemType.STORY]: BookOpen,
  [WorkItemType.BUG]: Bug,
  [WorkItemType.SUBTASK]: CheckSquare,
};

/** Couleurs de type reprises d'Azure DevOps : orange epic, bleu story, rouge bug. */
const TYPE_COLOR: Record<WorkItemType, string> = {
  [WorkItemType.EPIC]: 'text-[#8764B8]',
  [WorkItemType.STORY]: 'text-accent-500',
  [WorkItemType.BUG]: 'text-danger',
  [WorkItemType.SUBTASK]: 'text-ink-400',
};

export function TypeIcon({ type, className }: { type: WorkItemType; className?: string }) {
  const Icon = TYPE_ICON[type];
  return (
    <Icon
      className={cn('size-3.5 shrink-0', TYPE_COLOR[type], className)}
      strokeWidth={2}
      aria-label={LABELS_FR.workItemType[type]}
    />
  );
}

const PRIORITY_TONE = {
  [Priority.CRITICAL]: 'danger',
  [Priority.HIGH]: 'warning',
  [Priority.MEDIUM]: 'neutral',
  [Priority.LOW]: 'neutral',
} as const;

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{LABELS_FR.priority[priority]}</Badge>;
}

const STATUS_TONE = {
  [WorkItemStatus.TODO]: 'neutral',
  [WorkItemStatus.IN_PROGRESS]: 'accent',
  [WorkItemStatus.IN_TEST]: 'warning',
  [WorkItemStatus.READY_FOR_APPROVAL]: 'warning',
  [WorkItemStatus.DONE]: 'success',
} as const;

export function StatusPill({ status }: { status: WorkItemStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{LABELS_FR.workItemStatus[status]}</Badge>;
}

export function StoryPoints({ points }: { points: number | null }) {
  if (points === null) return null;
  return (
    <span
      className="bg-surface-sunken text-ink-500 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      title={`${points} point(s)`}
    >
      {points}
    </span>
  );
}

export function LabelChips({ labels }: { labels: { id: string; name: string; color: string }[] }) {
  if (labels.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {labels.map((label) => (
        <span
          key={label.id}
          className="rounded px-1 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: label.color }}
        >
          {label.name}
        </span>
      ))}
    </span>
  );
}

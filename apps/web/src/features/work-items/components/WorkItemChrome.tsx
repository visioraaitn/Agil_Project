import type { ComponentType, SVGProps } from 'react';
import { Bug, BookOpen, Crown, Flag } from 'lucide-react';
import { LABELS_FR, Priority, WorkItemStatus, WorkItemType } from '@visiora/shared';
import { SubtaskIcon } from '@/components/common/SubtaskIcon';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<WorkItemType, ComponentType<SVGProps<SVGSVGElement>>> = {
  [WorkItemType.EPIC]: Crown,
  [WorkItemType.STORY]: BookOpen,
  [WorkItemType.BUG]: Bug,
  [WorkItemType.SUBTASK]: SubtaskIcon,
};

/** Couleurs de type reprises d'Azure DevOps : violet epic, bleu story, rouge bug. */
const TYPE_COLOR: Record<WorkItemType, string> = {
  [WorkItemType.EPIC]: 'text-purple',
  [WorkItemType.STORY]: 'text-accent-500',
  [WorkItemType.BUG]: 'text-danger',
  [WorkItemType.SUBTASK]: 'text-subtask',
};

export function TypeIcon({
  type,
  className,
  boxed = false,
}: {
  type: WorkItemType;
  className?: string;
  /** Pictogramme posé sur une tuile teintée (en-têtes d'epic). */
  boxed?: boolean;
}) {
  const Icon = TYPE_ICON[type];
  const icon = (
    <Icon
      className={cn('size-3.5 shrink-0', TYPE_COLOR[type], className)}
      strokeWidth={2}
      aria-label={LABELS_FR.workItemType[type]}
    />
  );
  if (!boxed) return icon;
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md',
        type === WorkItemType.EPIC
          ? 'bg-[color-mix(in_srgb,var(--color-purple)_14%,transparent)]'
          : 'bg-surface-sunken',
      )}
    >
      {icon}
    </span>
  );
}

/** Clé de ticket en police mono, comme dans les outils de suivi. */
export function TicketKey({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn('text-ink-500 font-mono text-[11px] whitespace-nowrap', className)}>
      {value}
    </span>
  );
}

const PRIORITY_STYLE: Record<Priority, { pill: string; text: string }> = {
  [Priority.CRITICAL]: {
    pill: 'bg-red-50 text-danger dark:bg-red-950/40',
    text: 'text-danger',
  },
  [Priority.HIGH]: {
    pill: 'bg-orange-50 text-warning dark:bg-orange-950/40',
    text: 'text-warning',
  },
  [Priority.MEDIUM]: { pill: 'bg-surface-sunken text-ink-600', text: 'text-ink-600' },
  [Priority.LOW]: { pill: 'bg-surface-sunken text-ink-500', text: 'text-ink-500' },
};

/** Priorité avec drapeau : pastille sur les cartes, texte coloré dans les listes. */
export function PriorityBadge({
  priority,
  variant = 'pill',
}: {
  priority: Priority;
  variant?: 'pill' | 'text';
}) {
  const style = PRIORITY_STYLE[priority];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap',
        variant === 'pill' ? cn('rounded-md px-1.5 py-0.5', style.pill) : style.text,
      )}
    >
      <Flag className="size-3 shrink-0" strokeWidth={2} />
      {LABELS_FR.priority[priority]}
    </span>
  );
}

const STATUS_TONE: Record<WorkItemStatus, BadgeTone> = {
  [WorkItemStatus.TODO]: 'neutral',
  [WorkItemStatus.IN_PROGRESS]: 'accent',
  [WorkItemStatus.IN_TEST]: 'warning',
  [WorkItemStatus.READY_FOR_APPROVAL]: 'purple',
  [WorkItemStatus.DONE]: 'success',
};

export function StatusPill({ status }: { status: WorkItemStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {LABELS_FR.workItemStatus[status]}
    </Badge>
  );
}

/** Points d'effort en pastille grise ; `compact` n'affiche que le nombre. */
export function StoryPoints({
  points,
  compact = false,
}: {
  points: number | null;
  compact?: boolean;
}) {
  if (points === null) return null;
  return (
    <span
      className="bg-surface-sunken text-ink-700 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums whitespace-nowrap"
      title={`${points} point(s)`}
    >
      {compact ? points : `${points} pts`}
    </span>
  );
}

/** Pastille teintée dérivée de la couleur de l'étiquette (fond clair, texte foncé). */
function TintedChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        color: `color-mix(in srgb, ${color} 72%, var(--color-ink-900))`,
      }}
    >
      {name}
    </span>
  );
}

export function LabelChips({ labels }: { labels?: { id: string; name: string; color: string }[] }) {
  if (!labels || labels.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {labels.map((label) => (
        <TintedChip key={label.id} name={label.name} color={label.color} />
      ))}
    </span>
  );
}

export function TagChips({ tags }: { tags?: { id: string; name: string; color: string }[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <TintedChip key={tag.id} name={tag.name} color={tag.color} />
      ))}
    </span>
  );
}

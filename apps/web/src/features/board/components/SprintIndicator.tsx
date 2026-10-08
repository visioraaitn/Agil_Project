import type { SprintSummary } from '@visiora/shared';
import { SprintStatusBadge } from '@/features/sprints/components/SprintStatusBadge';
import { formatSprintDate } from '@/features/sprints/format';

/** Rappel du sprint affiché par le board : statut réel et période. */
export function SprintIndicator({ sprint }: { sprint: SprintSummary }) {
  return (
    <span className="flex items-center gap-1.5" aria-live="polite">
      <SprintStatusBadge status={sprint.status} />
      <span className="text-ink-500 text-xs whitespace-nowrap">
        {formatSprintDate(sprint.startDate)} – {formatSprintDate(sprint.endDate)}
      </span>
    </span>
  );
}

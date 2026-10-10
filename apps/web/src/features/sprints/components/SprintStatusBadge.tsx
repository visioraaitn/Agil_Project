import { LABELS_FR, SprintStatus } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';

const SPRINT_STATUS_TONE = {
  [SprintStatus.PLANNED]: 'accent',
  [SprintStatus.ACTIVE]: 'success',
  [SprintStatus.COMPLETED]: 'neutral',
} as const;

/** Statut d'un sprint (Planifié / Actif / Terminé), partagé par la page Sprints et le Board. */
export function SprintStatusBadge({ status }: { status: SprintStatus }) {
  return (
    <Badge tone={SPRINT_STATUS_TONE[status]} dot>
      {LABELS_FR.sprintStatus[status]}
    </Badge>
  );
}

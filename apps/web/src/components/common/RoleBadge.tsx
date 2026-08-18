import { LABELS_FR, ProjectRole } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';

const TONES = {
  [ProjectRole.PRODUCT_OWNER]: 'accent',
  [ProjectRole.SCRUM_MASTER]: 'success',
  [ProjectRole.DEVELOPER]: 'neutral',
  [ProjectRole.VIEWER]: 'neutral',
} as const;

export function RoleBadge({ role }: { role: ProjectRole }) {
  return <Badge tone={TONES[role]}>{LABELS_FR.projectRole[role]}</Badge>;
}

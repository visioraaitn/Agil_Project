import { LABELS_FR, ProjectRole } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';

const TONES = {
  [ProjectRole.PROJECT_LEAD]: 'accent',
  [ProjectRole.MEMBER]: 'neutral',
} as const;

export function RoleBadge({ role }: { role: ProjectRole }) {
  return <Badge tone={TONES[role]}>{LABELS_FR.projectRole[role]}</Badge>;
}

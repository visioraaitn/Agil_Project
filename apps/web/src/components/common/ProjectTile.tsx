import type { ProjectSummary } from '@visiora/shared';
import { cn } from '@/lib/utils';

/** Tuile du projet : teinte claire de la couleur du projet, initiales dans la couleur pleine. */
export function ProjectTile({
  project,
  size = 'md',
}: {
  project?: Pick<ProjectSummary, 'key' | 'color'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const color = project?.color ?? '#0078D4';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center font-bold',
        size === 'sm' && 'size-6 rounded-md text-[10px]',
        size === 'md' && 'size-8 rounded-lg text-xs',
        size === 'lg' && 'size-14 rounded-xl text-lg text-white',
      )}
      style={
        size === 'lg'
          ? { backgroundColor: color }
          : { backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`, color }
      }
    >
      {project?.key.slice(0, 2) ?? 'VI'}
    </span>
  );
}

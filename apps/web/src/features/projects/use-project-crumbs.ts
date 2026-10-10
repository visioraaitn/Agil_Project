import type { Crumb } from '@/components/common/PageHeader';
import { useProject } from './hooks';

/** Fil d'Ariane « Projet > Page » commun aux écrans d'un projet. */
export function useProjectCrumbs(projectKey: string, page: string): Crumb[] {
  const { data: project } = useProject(projectKey);
  return [
    { label: project?.name ?? projectKey, to: `/projects/${projectKey}/overview` },
    { label: page },
  ];
}

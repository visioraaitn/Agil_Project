import { WorkItemStatus } from '@visiora/shared';

/** Couleur de puce d'un statut (en-têtes de colonnes, légendes). */
export const STATUS_DOT: Record<WorkItemStatus, string> = {
  [WorkItemStatus.TODO]: 'bg-status-todo',
  [WorkItemStatus.IN_PROGRESS]: 'bg-status-progress',
  [WorkItemStatus.IN_TEST]: 'bg-status-test',
  [WorkItemStatus.READY_FOR_APPROVAL]: 'bg-status-ready',
  [WorkItemStatus.DONE]: 'bg-status-done',
};

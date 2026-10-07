import type { WorkItemStatus } from '@visiora/shared';

const COLUMN_PREFIX = 'column:';

/**
 * Identifiant droppable d'une zone de colonne. `scope` distingue les cellules
 * d'une même colonne de statut réparties sur plusieurs lignes (vue hiérarchique) :
 * dnd-kit exige des identifiants uniques, le statut reste la seule donnée métier.
 */
export function columnDropId(status: WorkItemStatus, scope?: string): string {
  return scope ? `${COLUMN_PREFIX}${status}:${scope}` : `${COLUMN_PREFIX}${status}`;
}

/** Statut ciblé par une zone de dépôt, ou null si `overId` désigne une carte. */
export function parseColumnDropId(overId: string): WorkItemStatus | null {
  if (!overId.startsWith(COLUMN_PREFIX)) return null;
  const [status] = overId.slice(COLUMN_PREFIX.length).split(':');
  return (status as WorkItemStatus | undefined) ?? null;
}

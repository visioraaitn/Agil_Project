const COLUMN_PREFIX = 'column:';
const COLUMN_SORT_PREFIX = 'column-sort:';

/**
 * Identifiant droppable d'une zone de colonne. Il repose sur l'identifiant de
 * la colonne — jamais sur son statut, que plusieurs colonnes peuvent partager.
 * `scope` distingue les cellules d'une même colonne réparties sur plusieurs
 * lignes ou couloirs : dnd-kit exige des identifiants uniques.
 */
export function columnDropId(columnId: string, scope?: string): string {
  return scope ? `${COLUMN_PREFIX}${columnId}:${scope}` : `${COLUMN_PREFIX}${columnId}`;
}

/** Colonne ciblée par une zone de dépôt, ou null si `overId` désigne une carte. */
export function parseColumnDropId(overId: string): string | null {
  if (!overId.startsWith(COLUMN_PREFIX)) return null;
  const [columnId] = overId.slice(COLUMN_PREFIX.length).split(':');
  return columnId || null;
}

/**
 * Identifiant « triable » d'un en-tête de colonne. Préfixé pour ne jamais
 * entrer en collision avec une carte ni avec une zone de dépôt.
 */
export function columnSortId(columnId: string): string {
  return `${COLUMN_SORT_PREFIX}${columnId}`;
}

export function parseColumnSortId(id: string): string | null {
  return id.startsWith(COLUMN_SORT_PREFIX) ? id.slice(COLUMN_SORT_PREFIX.length) : null;
}

/** Données attachées aux éléments déplaçables, pour séparer les deux glisser-déposer. */
export type BoardDragData = { kind: 'card' } | { kind: 'column' };

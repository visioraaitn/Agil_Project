import type { BacklogNode, WorkItemSummary } from '@visiora/shared';
import { ALLOWED_PARENT_TYPES, BOARD_CARD_TYPES, WorkItemType } from '@visiora/shared';

/**
 * D.1 · Task Board façon Azure DevOps.
 *
 * - La colonne Work Items porte UN ticket par ligne : un Epic ou une User Story.
 * - Les colonnes du workflow portent les Sous-tâches et les Bugs de cette
 *   User Story — un ou plusieurs par ligne, chacun dans la colonne de son état.
 *
 * La hiérarchie vient exclusivement des relations parent/enfant réelles de
 * l'arbre du backlog ; aucune clé n'est interprétée.
 */

/** Types affichés comme lignes du board. */
export const ROW_TYPES: readonly WorkItemType[] = [WorkItemType.EPIC, WorkItemType.STORY];

/** Types posés comme cartes dans les colonnes du workflow (règle partagée avec l'API). */
export const CARD_TYPES: readonly WorkItemType[] = BOARD_CARD_TYPES;

const isRowType = (type: WorkItemType) => ROW_TYPES.includes(type);

interface RowBase {
  rowId: string;
  /** Niveau dans l'arbre : sert uniquement au retrait dans la cellule Work Items. */
  depth: number;
  /** Dernier enfant de son parent : le connecteur se termine en « └ ». */
  isLast: boolean;
  /** Pour chaque niveau d'ancêtre, true si son trait vertical se prolonge sur cette ligne. */
  guides: boolean[];
  /** Sous-tâches posées dans les colonnes de la ligne. */
  cards: WorkItemSummary[];
}

export type BoardRow =
  | (RowBase & {
      kind: 'work-item';
      item: BacklogNode;
      collapsed: boolean;
      /** Epic suivi de lignes User Story imbriquées (vue hiérarchique). */
      hasChildRows: boolean;
    })
  /** Cartes sans User Story connue (ex. bug ancien resté à la racine) — jamais masquées. */
  | (RowBase & { kind: 'unlinked' });

export interface BoardRowsOptions {
  /** Sprint affiché : ses Epics et User Stories ont une ligne même sans carte. */
  sprintId: string | null;
  /** Filtres actifs : seules les lignes ayant au moins une sous-tâche visible restent. */
  onlyWithCards?: boolean;
  /** Restreint les lignes à un couloir (Assigné, Priorité, Epic). */
  include?: (item: BacklogNode) => boolean;
  /** Imbrique les User Stories sous leur Epic (connecteurs, repli). */
  nested?: boolean;
  /** Préfixe des identifiants de ligne : rend les lignes uniques d'un couloir à l'autre. */
  scope?: string;
  collapsed?: ReadonlySet<string>;
  /** Ajoute la ligne des sous-tâches orphelines (une seule section doit la porter). */
  withUnlinked?: boolean;
}

export const workItemRowId = (itemId: string, scope = '') => `${scope}row:${itemId}`;

function flatten(nodes: BacklogNode[]): BacklogNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/** Sous-tâches du board regroupées par ticket parent. */
function cardsByParent(cards: WorkItemSummary[]): Map<string, WorkItemSummary[]> {
  const map = new Map<string, WorkItemSummary[]>();
  for (const card of cards) {
    if (!card.parentId) continue;
    map.set(card.parentId, [...(map.get(card.parentId) ?? []), card]);
  }
  return map;
}

/**
 * Tickets « ligne » du board, dans l'ordre du backlog : ceux du sprint
 * affiché, plus les parents des sous-tâches visibles (même planifiés ailleurs).
 */
export function boardRowItems(
  tree: BacklogNode[],
  cards: WorkItemSummary[],
  sprintId: string | null,
  onlyWithCards = false,
): BacklogNode[] {
  const byParent = cardsByParent(cards);
  return flatten(tree).filter(
    (node) =>
      isRowType(node.type) &&
      (byParent.has(node.id) || (!onlyWithCards && node.sprintId === sprintId)),
  );
}

/** Epic racine de chaque ticket, résolu par les vraies relations parent/enfant. */
export function rootEpicIds(tree: BacklogNode[]): Map<string, string> {
  const result = new Map<string, string>();
  const walk = (node: BacklogNode, epicId: string | null) => {
    const currentEpic = node.type === WorkItemType.EPIC ? node.id : epicId;
    if (currentEpic) result.set(node.id, currentEpic);
    for (const child of node.children) walk(child, currentEpic);
  };
  for (const node of tree) walk(node, null);
  return result;
}

/**
 * Lignes du board : un ticket (Epic, User Story) par ligne, avec ses
 * sous-tâches et bugs comme cartes. En vue imbriquée, les Stories suivent leur
 * Epic avec un retrait — dans la cellule Work Items uniquement.
 */
export function buildBoardRows(
  tree: BacklogNode[],
  cards: WorkItemSummary[],
  options: BoardRowsOptions,
): { rows: BoardRow[]; collapsibleIds: string[] } {
  const {
    sprintId,
    onlyWithCards = false,
    include = () => true,
    nested = false,
    scope = '',
    collapsed = new Set<string>(),
    withUnlinked = true,
  } = options;

  const all = flatten(tree);
  const byId = new Map(all.map((node) => [node.id, node]));
  const byParent = cardsByParent(cards);
  const shown = new Set(
    boardRowItems(tree, cards, sprintId, onlyWithCards)
      .filter(include)
      .map((item) => item.id),
  );
  // Vue hiérarchique : l'Epic d'une User Story affichée a sa ligne, même s'il
  // n'est pas lui-même planifié dans le sprint — c'est lui qui regroupe.
  if (nested) {
    for (const id of [...shown]) {
      const parentId = byId.get(id)?.parentId;
      const parent = parentId ? byId.get(parentId) : undefined;
      if (parent?.type === WorkItemType.EPIC && include(parent)) shown.add(parent.id);
    }
  }
  const rows: BoardRow[] = [];
  const collapsibleIds: string[] = [];

  const pushRow = (item: BacklogNode, depth: number, isLast: boolean) => {
    const rowId = workItemRowId(item.id, scope);
    const childRows =
      nested && item.type === WorkItemType.EPIC
        ? item.children.filter((child) => shown.has(child.id))
        : [];
    const isCollapsed = childRows.length > 0 && collapsed.has(rowId);
    if (childRows.length > 0) collapsibleIds.push(rowId);
    rows.push({
      kind: 'work-item',
      rowId,
      depth,
      isLast,
      guides: [],
      item,
      collapsed: isCollapsed,
      hasChildRows: childRows.length > 0,
      cards: byParent.get(item.id) ?? [],
    });
    if (isCollapsed) return;
    childRows.forEach((child, index) => pushRow(child, depth + 1, index === childRows.length - 1));
  };

  // Racines : en vue imbriquée, une Story dont l'Epic est affiché se range sous lui.
  const roots = all.filter((node) => {
    if (!shown.has(node.id)) return false;
    if (!nested || node.type === WorkItemType.EPIC) return true;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    return !(parent?.type === WorkItemType.EPIC && shown.has(parent.id));
  });
  roots.forEach((root, index) => pushRow(root, 0, index === roots.length - 1));

  if (withUnlinked) {
    const orphans = cards.filter((card) => !card.parentId || !byId.has(card.parentId));
    if (orphans.length > 0) {
      rows.push({
        kind: 'unlinked',
        rowId: `${scope}unlinked`,
        depth: 0,
        isLast: true,
        guides: [],
        cards: orphans,
      });
    }
  }

  return { rows, collapsibleIds };
}

/**
 * Types qu'on peut créer sous un ticket, dérivés de la règle partagée
 * ALLOWED_PARENT_TYPES (Epic → User Story ; User Story → Sous-tâche ou Bug).
 */
export function childTypesOf(parentType: WorkItemType): WorkItemType[] {
  return Object.values(WorkItemType).filter((type) =>
    ALLOWED_PARENT_TYPES[type].includes(parentType),
  );
}

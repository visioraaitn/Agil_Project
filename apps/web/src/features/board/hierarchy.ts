import type { BacklogNode, WorkItemSummary } from '@visiora/shared';
import { WorkItemType } from '@visiora/shared';

export interface HierarchyStoryLane {
  id: string;
  key: string;
  title: string;
  type: WorkItemType;
  /** La carte de la Story/Bug elle-même, si elle correspond aux filtres actifs, plus ses Sous-tâches. */
  items: WorkItemSummary[];
}

export interface HierarchyEpicLane {
  id: string;
  key: string;
  title: string;
  /** true pour le regroupement synthétique des Story/Bug sans Epic parent. */
  isNoEpic: boolean;
  stories: HierarchyStoryLane[];
}

export interface HierarchyBoard {
  epics: HierarchyEpicLane[];
  /** Tickets du board introuvables dans l'arbre (ex. désynchronisation de cache) — jamais masqués. */
  unlinked: WorkItemSummary[];
}

const NO_EPIC_LANE_ID = 'no-epic';

/**
 * Regroupe les items du board (déjà filtrés par le board) en couloirs
 * Epic > Story/Bug, en résolvant la hiérarchie réelle via l'arbre COMPLET du
 * backlog (non filtré) plutôt que le seul `parentId` direct. Un ticket dont
 * le parent ne correspond pas aux filtres actifs du board reste ainsi
 * rattaché à la bonne Story au lieu de disparaître (même principe que le
 * backlog hiérarchique).
 */
export function buildHierarchyLanes(
  tree: BacklogNode[],
  items: WorkItemSummary[],
): HierarchyBoard {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const placed = new Set<string>();

  const buildStoryLane = (story: BacklogNode): HierarchyStoryLane | null => {
    const candidateIds = [story.id, ...story.children.map((child) => child.id)];
    const laneItems = candidateIds
      .map((id) => itemsById.get(id))
      .filter((item): item is WorkItemSummary => Boolean(item));
    if (laneItems.length === 0) return null;
    for (const item of laneItems) placed.add(item.id);
    return { id: story.id, key: story.key, title: story.title, type: story.type, items: laneItems };
  };

  const buildEpicLane = (
    epic: BacklogNode | null,
    storyRoots: BacklogNode[],
  ): HierarchyEpicLane | null => {
    const stories = storyRoots
      .map(buildStoryLane)
      .filter((lane): lane is HierarchyStoryLane => lane !== null);
    if (stories.length === 0) return null;
    return epic
      ? { id: epic.id, key: epic.key, title: epic.title, isNoEpic: false, stories }
      : { id: NO_EPIC_LANE_ID, key: '', title: 'Sans Epic', isNoEpic: true, stories };
  };

  const epics: HierarchyEpicLane[] = [];
  const rootStoriesWithoutEpic: BacklogNode[] = [];

  for (const node of tree) {
    if (node.type === WorkItemType.EPIC) {
      const lane = buildEpicLane(node, node.children);
      if (lane) epics.push(lane);
    } else if (node.type === WorkItemType.STORY || node.type === WorkItemType.BUG) {
      rootStoriesWithoutEpic.push(node);
    }
  }

  const noEpicLane = buildEpicLane(null, rootStoriesWithoutEpic);
  if (noEpicLane) epics.push(noEpicLane);

  const unlinked = items.filter((item) => !placed.has(item.id));

  return { epics, unlinked };
}

export const epicRowId = (epicLaneId: string) => `epic:${epicLaneId}`;
export const storyRowId = (storyLaneId: string) => `story:${storyLaneId}`;

/** Les descendants d'une Story/Bug sur le board : ses Sous-tâches, hors la carte de la Story elle-même. */
export function storyDescendants(lane: HierarchyStoryLane): WorkItemSummary[] {
  return lane.items.filter((item) => item.id !== lane.id);
}

export type HierarchyRow =
  | {
      kind: 'epic';
      rowId: string;
      lane: HierarchyEpicLane;
      collapsed: boolean;
      /** Toutes les cartes descendantes (Stories, Bugs, Sous-tâches), repliées ou non. */
      descendants: WorkItemSummary[];
    }
  | {
      kind: 'story';
      rowId: string;
      lane: HierarchyStoryLane;
      collapsed: boolean;
      hasChildren: boolean;
      /** Cartes posées dans les colonnes de statut de la ligne. */
      cards: WorkItemSummary[];
    }
  | { kind: 'unlinked'; rowId: string; cards: WorkItemSummary[] };

/** Identifiants de toutes les lignes repliables (parents ayant des enfants visibles). */
export function collapsibleRowIds(board: HierarchyBoard): string[] {
  return board.epics.flatMap((epic) => [
    epicRowId(epic.id),
    ...epic.stories
      .filter((story) => storyDescendants(story).length > 0)
      .map((story) => storyRowId(story.id)),
  ]);
}

/**
 * Aplatit la hiérarchie en lignes affichables, en respectant les replis :
 * un Epic replié masque toute sa descendance, une Story repliée masque ses
 * Sous-tâches mais garde sa propre carte dans sa colonne de statut réelle.
 */
export function flattenVisibleRows(
  board: HierarchyBoard,
  collapsed: ReadonlySet<string>,
): HierarchyRow[] {
  const rows: HierarchyRow[] = [];

  for (const epic of board.epics) {
    const rowId = epicRowId(epic.id);
    const epicCollapsed = collapsed.has(rowId);
    rows.push({
      kind: 'epic',
      rowId,
      lane: epic,
      collapsed: epicCollapsed,
      descendants: epic.stories.flatMap((story) => story.items),
    });
    if (epicCollapsed) continue;

    for (const story of epic.stories) {
      const storyRow = storyRowId(story.id);
      const storyCollapsed = collapsed.has(storyRow);
      const children = storyDescendants(story);
      rows.push({
        kind: 'story',
        rowId: storyRow,
        lane: story,
        collapsed: storyCollapsed,
        hasChildren: children.length > 0,
        cards: storyCollapsed ? story.items.filter((item) => item.id === story.id) : story.items,
      });
    }
  }

  if (board.unlinked.length > 0) {
    rows.push({ kind: 'unlinked', rowId: 'unlinked', cards: board.unlinked });
  }

  return rows;
}

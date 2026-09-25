import type { BacklogNode, WorkItemSummary } from '@visiora/shared';
import { WorkItemType } from '@visiora/shared';

export interface HierarchyStoryLane {
  id: string;
  key: string;
  title: string;
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
    return { id: story.id, key: story.key, title: story.title, items: laneItems };
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

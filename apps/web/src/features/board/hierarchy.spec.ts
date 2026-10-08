import { describe, expect, it } from 'vitest';
import { Priority, WorkItemStatus, WorkItemType, type BacklogNode } from '@visiora/shared';
import {
  buildHierarchyLanes,
  collapsibleRowIds,
  epicRowId,
  flattenVisibleRows,
  storyRowId,
} from './hierarchy';

const REPORTER = { id: 'u1', name: 'Reporter', email: 'r@x.com', avatarUrl: null };

function node(overrides: Partial<BacklogNode> & Pick<BacklogNode, 'id' | 'key' | 'type'>): BacklogNode {
  return {
    number: 1,
    projectId: 'project-1',
    title: overrides.title ?? overrides.key,
    status: WorkItemStatus.TODO,
    priority: Priority.MEDIUM,
    storyPoints: null,
    rank: 'm',
    isBlocked: false,
    blockedReason: null,
    parentId: null,
    sprintId: null,
    startDate: null,
    dueDate: null,
    assignee: null,
    assignees: [],
    reporter: REPORTER,
    labels: [],
    tags: [],
    childCount: 0,
    doneChildCount: 0,
    rolledUpPoints: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    children: [],
    ...overrides,
  };
}

describe('buildHierarchyLanes', () => {
  it('construit les couloirs Epic > Story avec les items imbriqués, y compris les tickets sans Epic', () => {
    const t1 = node({ id: 't1', key: 'VIS-1-1-T1', type: WorkItemType.SUBTASK, parentId: 's1' });
    const s1 = node({
      id: 's1',
      key: 'VIS-1-1',
      type: WorkItemType.STORY,
      parentId: 'e1',
      children: [t1],
    });
    const s2 = node({ id: 's2', key: 'VIS-1-2', type: WorkItemType.STORY, parentId: 'e1' });
    const e1 = node({ id: 'e1', key: 'VIS-1', type: WorkItemType.EPIC, children: [s1, s2] });
    const s3 = node({ id: 's3', key: 'VIS-US-1', type: WorkItemType.STORY });

    const tree = [e1, s3];
    const items = [s1, t1, s2, s3];

    const result = buildHierarchyLanes(tree, items);

    expect(result.unlinked).toHaveLength(0);
    const epicLane = result.epics.find((lane) => lane.id === 'e1');
    expect(epicLane?.stories.map((story) => story.id).sort()).toEqual(['s1', 's2']);
    expect(epicLane?.stories.find((story) => story.id === 's1')?.items.map((i) => i.id).sort()).toEqual(
      ['s1', 't1'],
    );

    const noEpicLane = result.epics.find((lane) => lane.isNoEpic);
    expect(noEpicLane?.stories.map((story) => story.id)).toEqual(['s3']);
  });

  it("garde une Sous-tâche rattachée à sa Story même si la Story n'est pas dans le jeu filtré", () => {
    const t1 = node({ id: 't1', key: 'VIS-1-1-T1', type: WorkItemType.SUBTASK, parentId: 's1' });
    const s1 = node({
      id: 's1',
      key: 'VIS-1-1',
      type: WorkItemType.STORY,
      parentId: 'e1',
      children: [t1],
    });
    const e1 = node({ id: 'e1', key: 'VIS-1', type: WorkItemType.EPIC, children: [s1] });

    // Filtre "type = Sous-tâche" côté board : seule la Sous-tâche apparaît dans `items`.
    const result = buildHierarchyLanes([e1], [t1]);

    const epicLane = result.epics.find((lane) => lane.id === 'e1');
    const storyLane = epicLane?.stories.find((story) => story.id === 's1');
    expect(storyLane?.items.map((i) => i.id)).toEqual(['t1']);
    expect(result.unlinked).toHaveLength(0);
  });

  it('expose le type réel de la Story/Bug du couloir', () => {
    const b1 = node({ id: 'b1', key: 'VIS-1-B1', type: WorkItemType.BUG, parentId: 'e1' });
    const e1 = node({ id: 'e1', key: 'VIS-1', type: WorkItemType.EPIC, children: [b1] });

    const result = buildHierarchyLanes([e1], [b1]);

    expect(result.epics[0]?.stories[0]?.type).toBe(WorkItemType.BUG);
  });

  it("classe un ticket introuvable dans l'arbre en non-lié plutôt que de le masquer", () => {
    const ghost = node({ id: 'ghost', key: 'VIS-9', type: WorkItemType.STORY });

    const result = buildHierarchyLanes([], [ghost]);

    expect(result.epics).toHaveLength(0);
    expect(result.unlinked.map((i) => i.id)).toEqual(['ghost']);
  });
});

describe('flattenVisibleRows', () => {
  // Epic e1 > Story s1 (Sous-tâches t1 À faire, t2 En test) + Story s2 sans enfant.
  const t1 = node({ id: 't1', key: 'VIS-1-1-T1', type: WorkItemType.SUBTASK, parentId: 's1' });
  const t2 = node({
    id: 't2',
    key: 'VIS-1-1-T2',
    type: WorkItemType.SUBTASK,
    parentId: 's1',
    status: WorkItemStatus.IN_TEST,
  });
  const s1 = node({
    id: 's1',
    key: 'VIS-1-1',
    type: WorkItemType.STORY,
    parentId: 'e1',
    status: WorkItemStatus.IN_PROGRESS,
    children: [t1, t2],
  });
  const s2 = node({ id: 's2', key: 'VIS-1-2', type: WorkItemType.STORY, parentId: 'e1' });
  const e1 = node({ id: 'e1', key: 'VIS-1', type: WorkItemType.EPIC, children: [s1, s2] });
  const board = buildHierarchyLanes([e1], [s1, t1, t2, s2]);

  const visibleCardIds = (collapsed: Set<string>) =>
    flattenVisibleRows(board, collapsed)
      .flatMap((row) => (row.kind === 'epic' ? [] : row.cards))
      .map((item) => item.id)
      .sort();

  it("ne rend repliables que l'Epic et les Stories ayant des enfants", () => {
    expect(collapsibleRowIds(board)).toEqual([epicRowId('e1'), storyRowId('s1')]);
  });

  it('tout déplié : chaque carte garde son propre statut, sous la ligne de son parent', () => {
    const rows = flattenVisibleRows(board, new Set());
    expect(rows.map((row) => row.rowId)).toEqual([
      epicRowId('e1'),
      storyRowId('s1'),
      storyRowId('s2'),
    ]);
    const storyRow = rows[1];
    expect(storyRow?.kind === 'story' && storyRow.hasChildren).toBe(true);
    const cards = storyRow?.kind === 'story' ? storyRow.cards : [];
    expect(cards.find((item) => item.id === 't2')?.status).toBe(WorkItemStatus.IN_TEST);
    expect(cards.find((item) => item.id === 's1')?.status).toBe(WorkItemStatus.IN_PROGRESS);
  });

  it('replier une Story masque ses Sous-tâches mais pas les autres Stories', () => {
    expect(visibleCardIds(new Set([storyRowId('s1')]))).toEqual(['s1', 's2']);
  });

  it('replier un Epic masque toute sa descendance, même une Story dépliée', () => {
    const rows = flattenVisibleRows(board, new Set([epicRowId('e1')]));
    expect(rows.map((row) => row.rowId)).toEqual([epicRowId('e1')]);
    expect(visibleCardIds(new Set([epicRowId('e1')]))).toEqual([]);
  });

  it('Tout replier puis Tout déplier restaure la hiérarchie complète', () => {
    expect(visibleCardIds(new Set(collapsibleRowIds(board)))).toEqual([]);
    expect(visibleCardIds(new Set())).toEqual(['s1', 's2', 't1', 't2']);
  });
});

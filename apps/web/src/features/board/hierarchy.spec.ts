import { describe, expect, it } from 'vitest';
import { Priority, WorkItemStatus, WorkItemType, type BacklogNode } from '@visiora/shared';
import {
  boardRowItems,
  buildBoardRows,
  childTypesOf,
  rootEpicIds,
  workItemRowId,
} from './hierarchy';

const REPORTER = { id: 'u1', name: 'Reporter', email: 'r@x.com', avatarUrl: null };
const SPRINT = 'sprint-1';

function node(
  overrides: Partial<BacklogNode> & Pick<BacklogNode, 'id' | 'key' | 'type'>,
): BacklogNode {
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
    sprintId: SPRINT,
    boardColumnId: null,
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

// Epic e1 > Story s1 (sous-tâche t1, bug bg) + Story s2 sans carte.
// Story s3 hors Epic. Story s9 planifiée dans un autre sprint.
const t1 = node({ id: 't1', key: 'VIS-1-1-T1', type: WorkItemType.SUBTASK, parentId: 's1' });
const bg = node({
  id: 'bg',
  key: 'VIS-1-1-B1',
  type: WorkItemType.BUG,
  parentId: 's1',
  status: WorkItemStatus.IN_TEST,
});
const s1 = node({
  id: 's1',
  key: 'VIS-1-1',
  type: WorkItemType.STORY,
  parentId: 'e1',
  children: [t1, bg],
});
const s2 = node({ id: 's2', key: 'VIS-1-2', type: WorkItemType.STORY, parentId: 'e1' });
const e1 = node({ id: 'e1', key: 'VIS-1', type: WorkItemType.EPIC, children: [s1, s2] });
const s3 = node({ id: 's3', key: 'VIS-US-3', type: WorkItemType.STORY });
const s9 = node({ id: 's9', key: 'VIS-US-9', type: WorkItemType.STORY, sprintId: 'other' });
const tree = [e1, s3, s9];
const cards = [t1, bg];

const rowIds = (rows: { kind: string; rowId: string }[]) => rows.map((row) => row.rowId);

describe('lignes du Task Board', () => {
  it('ne met dans la colonne Work Items que des Epics et des User Stories — une ligne chacun', () => {
    const { rows } = buildBoardRows(tree, cards, { sprintId: SPRINT });
    expect(rows.map((row) => (row.kind === 'work-item' ? row.item.id : row.kind))).toEqual([
      'e1',
      's1',
      's2',
      's3',
    ]);
  });

  it('pose sous-tâches et bugs de la User Story dans ses colonnes', () => {
    const { rows } = buildBoardRows(tree, cards, { sprintId: SPRINT });
    const cardsOf = (id: string) =>
      rows.find((row) => row.kind === 'work-item' && row.item.id === id)?.cards.map((c) => c.id);
    expect(cardsOf('s1')).toEqual(['t1', 'bg']);
    expect(cardsOf('e1')).toEqual([]);
    expect(cardsOf('s2')).toEqual([]);
  });

  it('ajoute la ligne d’une Story planifiée ailleurs quand ses cartes sont dans le sprint', () => {
    const t9 = node({ id: 't9', key: 'VIS-US-9-T1', type: WorkItemType.SUBTASK, parentId: 's9' });
    const withS9 = [e1, s3, { ...s9, children: [t9] }];
    expect(boardRowItems(withS9, [t9], SPRINT).map((item) => item.id)).toContain('s9');
  });

  it('avec des filtres actifs, ne garde que les lignes portant des cartes visibles', () => {
    const { rows } = buildBoardRows(tree, [bg], { sprintId: SPRINT, onlyWithCards: true });
    expect(rowIds(rows)).toEqual([workItemRowId('s1')]);
  });

  it('imbrique les Stories sous leur Epic en vue hiérarchique et permet de les replier', () => {
    const nested = buildBoardRows(tree, cards, { sprintId: SPRINT, nested: true });
    expect(nested.rows.map((row) => [row.rowId, row.depth])).toEqual([
      [workItemRowId('e1'), 0],
      [workItemRowId('s1'), 1],
      [workItemRowId('s2'), 1],
      [workItemRowId('s3'), 0],
    ]);
    expect(nested.collapsibleIds).toEqual([workItemRowId('e1')]);

    const folded = buildBoardRows(tree, cards, {
      sprintId: SPRINT,
      nested: true,
      collapsed: new Set([workItemRowId('e1')]),
    });
    expect(rowIds(folded.rows)).toEqual([workItemRowId('e1'), workItemRowId('s3')]);
  });

  it("en vue hiérarchique, donne une ligne à l'Epic d'une Story du sprint même s'il n'est pas planifié", () => {
    const sprintTree = [{ ...e1, sprintId: null }, s3];
    const flatView = buildBoardRows(sprintTree, cards, { sprintId: SPRINT, onlyWithCards: true });
    const nestedView = buildBoardRows(sprintTree, cards, {
      sprintId: SPRINT,
      onlyWithCards: true,
      nested: true,
    });
    expect(rowIds(flatView.rows)).toEqual([workItemRowId('s1')]);
    expect(nestedView.rows.map((row) => [row.rowId, row.depth])).toEqual([
      [workItemRowId('e1'), 0],
      [workItemRowId('s1'), 1],
    ]);
  });

  it('restreint les lignes à un couloir et préfixe leurs identifiants', () => {
    const { rows } = buildBoardRows(tree, cards, {
      sprintId: SPRINT,
      include: (item) => item.id === 's3',
      scope: 'lane|',
      withUnlinked: false,
    });
    expect(rowIds(rows)).toEqual(['lane|row:s3']);
  });

  it('garde une carte sans User Story (ancien bug racine) plutôt que de la masquer', () => {
    const legacyBug = node({ id: 'b0', key: 'VIS-B1', type: WorkItemType.BUG });
    const { rows } = buildBoardRows([], [legacyBug], { sprintId: SPRINT });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('unlinked');
    expect(rows[0]?.cards.map((card) => card.id)).toEqual(['b0']);
  });
});

describe('règles de création depuis le board', () => {
  it('crée sous-tâches et bugs sous une User Story, et rien de tel sous un Epic', () => {
    expect(childTypesOf(WorkItemType.STORY).sort()).toEqual(
      [WorkItemType.BUG, WorkItemType.SUBTASK].sort(),
    );
    expect(childTypesOf(WorkItemType.EPIC)).toEqual([WorkItemType.STORY]);
    expect(childTypesOf(WorkItemType.SUBTASK)).toEqual([]);
    expect(childTypesOf(WorkItemType.BUG)).toEqual([]);
  });
});

describe('rootEpicIds', () => {
  it("remonte chaque ticket à l'Epic racine par les vraies relations parent/enfant", () => {
    const roots = rootEpicIds(tree);
    expect(roots.get('bg')).toBe('e1');
    expect(roots.get('s1')).toBe('e1');
    expect(roots.get('e1')).toBe('e1');
    expect(roots.has('s3')).toBe(false);
  });
});

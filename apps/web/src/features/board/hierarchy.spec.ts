import { describe, expect, it } from 'vitest';
import { Priority, WorkItemStatus, WorkItemType, type BacklogNode } from '@visiora/shared';
import { buildHierarchyLanes } from './hierarchy';

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

  it("classe un ticket introuvable dans l'arbre en non-lié plutôt que de le masquer", () => {
    const ghost = node({ id: 'ghost', key: 'VIS-9', type: WorkItemType.STORY });

    const result = buildHierarchyLanes([], [ghost]);

    expect(result.epics).toHaveLength(0);
    expect(result.unlinked.map((i) => i.id)).toEqual(['ghost']);
  });
});

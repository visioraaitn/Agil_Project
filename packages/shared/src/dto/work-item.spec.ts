import { describe, expect, it } from 'vitest';
import { WorkItemStatus, WorkItemType } from '../enums';
import {
  canBeChildOf,
  createWorkItemSchema,
  deriveParentStatus,
  moveWorkItemSchema,
  REQUIRES_PARENT,
  STATUS_ROLLUP_CHILD_TYPES,
  workItemFiltersSchema,
} from './work-item';

describe('hiérarchie des tickets', () => {
  it('rattache une story à un epic, jamais l’inverse', () => {
    expect(canBeChildOf(WorkItemType.STORY, WorkItemType.EPIC)).toBe(true);
    expect(canBeChildOf(WorkItemType.EPIC, WorkItemType.STORY)).toBe(false);
  });

  it('rattache une sous-tâche et un bug à une user story uniquement', () => {
    for (const child of [WorkItemType.SUBTASK, WorkItemType.BUG]) {
      expect(canBeChildOf(child, WorkItemType.STORY)).toBe(true);
      expect(canBeChildOf(child, WorkItemType.EPIC)).toBe(false);
      expect(canBeChildOf(child, WorkItemType.BUG)).toBe(false);
      expect(canBeChildOf(child, WorkItemType.SUBTASK)).toBe(false);
    }
  });

  it('interdit un epic enfant de quoi que ce soit', () => {
    for (const parent of Object.values(WorkItemType)) {
      expect(canBeChildOf(WorkItemType.EPIC, parent)).toBe(false);
    }
  });

  it('interdit une sous-tâche sous une sous-tâche', () => {
    expect(canBeChildOf(WorkItemType.SUBTASK, WorkItemType.SUBTASK)).toBe(false);
  });

  it('exige une user story parente pour les sous-tâches et les bugs', () => {
    expect(REQUIRES_PARENT).toEqual([WorkItemType.SUBTASK, WorkItemType.BUG]);
  });
});

describe('createWorkItemSchema', () => {
  it('refuse une sous-tâche sans parent', () => {
    const result = createWorkItemSchema.safeParse({
      type: WorkItemType.SUBTASK,
      title: 'Écrire les tests',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['parentId']);
    }
  });

  it('accepte un epic sans parent et applique la priorité par défaut', () => {
    const result = createWorkItemSchema.safeParse({
      type: WorkItemType.EPIC,
      title: 'Gestion des accès',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priority).toBe('MEDIUM');
  });

  it('refuse un titre trop court', () => {
    const result = createWorkItemSchema.safeParse({ type: WorkItemType.STORY, title: 'ab' });
    expect(result.success).toBe(false);
  });

  it('accepte plusieurs personnes assignées sans imposer de doublon côté client', () => {
    const result = createWorkItemSchema.safeParse({
      type: WorkItemType.STORY,
      title: 'Développer la recherche',
      assigneeIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
    });
    expect(result.success).toBe(true);
  });
});

describe('workItemFiltersSchema', () => {
  it('valide le filtre créateur et un tri explicite', () => {
    const result = workItemFiltersSchema.safeParse({
      creatorId: '11111111-1111-4111-8111-111111111111',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(result.success).toBe(true);
  });
});

describe('moveWorkItemSchema', () => {
  it('accepte un déplacement de colonne sans voisin (fin de liste)', () => {
    expect(moveWorkItemSchema.safeParse({ status: 'IN_PROGRESS' }).success).toBe(true);
  });

  it('accepte un détachement explicite du parent', () => {
    const result = moveWorkItemSchema.safeParse({ parentId: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.parentId).toBeNull();
  });
});

describe('deriveParentStatus — le statut d’un parent suit ses enfants', () => {
  const { TODO, IN_PROGRESS, IN_TEST, READY_FOR_APPROVAL, DONE } = WorkItemStatus;

  it('termine la Story quand toutes ses cartes sont terminées', () => {
    expect(deriveParentStatus(IN_PROGRESS, [DONE, DONE])).toBe(DONE);
    expect(deriveParentStatus(TODO, [DONE])).toBe(DONE);
    expect(deriveParentStatus(IN_TEST, [DONE, DONE, DONE])).toBe(DONE);
  });

  it('rouvre une Story terminée dès qu’une carte quitte « Terminé »', () => {
    expect(deriveParentStatus(DONE, [DONE, IN_TEST])).toBe(IN_PROGRESS);
    // Ajout d'une nouvelle carte « À faire » à une Story terminée.
    expect(deriveParentStatus(DONE, [DONE, TODO])).toBe(IN_PROGRESS);
  });

  it('démarre une Story « À faire » dès qu’une carte est engagée', () => {
    expect(deriveParentStatus(TODO, [TODO, IN_PROGRESS])).toBe(IN_PROGRESS);
    expect(deriveParentStatus(TODO, [READY_FOR_APPROVAL])).toBe(IN_PROGRESS);
  });

  it('ne touche à rien sinon — la Story garde son statut posé à la main', () => {
    expect(deriveParentStatus(TODO, [TODO, TODO])).toBeNull();
    expect(deriveParentStatus(IN_TEST, [IN_PROGRESS, DONE])).toBeNull();
    expect(deriveParentStatus(READY_FOR_APPROVAL, [TODO])).toBeNull();
    expect(deriveParentStatus(IN_PROGRESS, [])).toBeNull();
    expect(deriveParentStatus(DONE, [])).toBeNull();
  });
});

describe('STATUS_ROLLUP_CHILD_TYPES', () => {
  it('fait suivre ses cartes à une User Story et ses User Stories à un Epic', () => {
    expect(STATUS_ROLLUP_CHILD_TYPES[WorkItemType.STORY]).toEqual([
      WorkItemType.SUBTASK,
      WorkItemType.BUG,
    ]);
    expect(STATUS_ROLLUP_CHILD_TYPES[WorkItemType.EPIC]).toEqual([WorkItemType.STORY]);
    expect(STATUS_ROLLUP_CHILD_TYPES[WorkItemType.SUBTASK]).toBeUndefined();
    expect(STATUS_ROLLUP_CHILD_TYPES[WorkItemType.BUG]).toBeUndefined();
  });
});

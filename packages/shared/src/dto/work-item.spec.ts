import { describe, expect, it } from 'vitest';
import { WorkItemType } from '../enums';
import {
  canBeChildOf,
  createWorkItemSchema,
  moveWorkItemSchema,
  REQUIRES_PARENT,
  workItemFiltersSchema,
} from './work-item';

describe('hiérarchie des tickets', () => {
  it('rattache une story à un epic, jamais l’inverse', () => {
    expect(canBeChildOf(WorkItemType.STORY, WorkItemType.EPIC)).toBe(true);
    expect(canBeChildOf(WorkItemType.EPIC, WorkItemType.STORY)).toBe(false);
  });

  it('rattache une sous-tâche à une story ou à un bug', () => {
    expect(canBeChildOf(WorkItemType.SUBTASK, WorkItemType.STORY)).toBe(true);
    expect(canBeChildOf(WorkItemType.SUBTASK, WorkItemType.BUG)).toBe(true);
    expect(canBeChildOf(WorkItemType.SUBTASK, WorkItemType.EPIC)).toBe(false);
  });

  it('interdit un epic enfant de quoi que ce soit', () => {
    for (const parent of Object.values(WorkItemType)) {
      expect(canBeChildOf(WorkItemType.EPIC, parent)).toBe(false);
    }
  });

  it('interdit une sous-tâche sous une sous-tâche', () => {
    expect(canBeChildOf(WorkItemType.SUBTASK, WorkItemType.SUBTASK)).toBe(false);
  });

  it('n’exige un parent que pour les sous-tâches', () => {
    expect(REQUIRES_PARENT).toEqual([WorkItemType.SUBTASK]);
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

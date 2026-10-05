import { describe, expect, it } from 'vitest';
import { UnfinishedItemsAction, closeSprintSchema } from './sprint';

describe('closeSprintSchema', () => {
  it('accepte la cloture sans choix quand aucun champ ne le force', () => {
    expect(closeSprintSchema.safeParse({}).success).toBe(true);
  });

  it('accepte BACKLOG sans sprint de destination', () => {
    const result = closeSprintSchema.safeParse({
      unfinishedItemsAction: UnfinishedItemsAction.BACKLOG,
    });
    expect(result.success).toBe(true);
  });

  it('exige targetSprintId quand unfinishedItemsAction vaut MOVE_TO_SPRINT', () => {
    const result = closeSprintSchema.safeParse({
      unfinishedItemsAction: UnfinishedItemsAction.MOVE_TO_SPRINT,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['targetSprintId']);
    }
  });

  it('accepte MOVE_TO_SPRINT avec un targetSprintId valide', () => {
    const result = closeSprintSchema.safeParse({
      unfinishedItemsAction: UnfinishedItemsAction.MOVE_TO_SPRINT,
      targetSprintId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.success).toBe(true);
  });
});

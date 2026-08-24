import { describe, expect, it } from 'vitest';
import { createProjectSchema, deleteProjectSchema } from './project';

describe('createProjectSchema', () => {
  it("accepte une création sans date d'échéance", () => {
    const project = createProjectSchema.parse({
      key: 'VIS',
      name: 'Visiora Planner',
      targetDate: '',
    });

    expect(project.targetDate).toBeNull();
  });

  it("convertit une date d'échéance fournie", () => {
    const project = createProjectSchema.parse({
      key: 'VIS',
      name: 'Visiora Planner',
      targetDate: '2026-12-31',
    });

    expect(project.targetDate).toBeInstanceOf(Date);
  });
});

describe('deleteProjectSchema', () => {
  it('exige un nom de confirmation non vide', () => {
    expect(deleteProjectSchema.safeParse({ confirmationName: '' }).success).toBe(false);
    expect(deleteProjectSchema.safeParse({ confirmationName: 'Visiora' }).success).toBe(true);
  });
});

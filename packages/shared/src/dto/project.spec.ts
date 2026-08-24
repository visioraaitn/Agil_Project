import { describe, expect, it } from 'vitest';
import { createProjectSchema } from './project';

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

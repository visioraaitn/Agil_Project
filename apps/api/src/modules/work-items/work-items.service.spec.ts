import { Priority, WorkItemStatus, WorkItemType, type WorkItemDetail } from '@visiora/shared';
import { WorkItemsService } from './work-items.service';

const USER_ONE = '11111111-1111-4111-8111-111111111111';
const USER_TWO = '22222222-2222-4222-8222-222222222222';

describe('WorkItemsService — assignations multiples', () => {
  it('crée le ticket avec tous les assignés et conserve le premier pour compatibilité', async () => {
    const tx = {
      workItem: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'item-1' }),
      },
    };
    const prisma = {
      projectMember: { count: jest.fn().mockResolvedValue(2) },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const ranking = {
      initialRanks: jest.fn().mockResolvedValue({ rank: 'a0', boardRank: 'b0' }),
    };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      ranking as unknown as ConstructorParameters<typeof WorkItemsService>[1],
    );
    jest.spyOn(service, 'getById').mockResolvedValue({} as WorkItemDetail);

    await service.create(
      'project-1',
      {
        type: WorkItemType.STORY,
        title: 'Implémenter la recherche',
        priority: Priority.MEDIUM,
        assigneeIds: [USER_ONE, USER_TWO, USER_ONE],
      },
      'reporter-1',
    );

    expect(prisma.projectMember.count).toHaveBeenCalledWith({
      where: { projectId: 'project-1', userId: { in: [USER_ONE, USER_TWO] } },
    });
    expect(tx.workItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assigneeId: USER_ONE,
          assignees: { create: [{ userId: USER_ONE }, { userId: USER_TWO }] },
        }),
      }),
    );
  });

  it('remplace toute la liste lors de la modification', async () => {
    const tx = {
      workItem: { update: jest.fn().mockResolvedValue({ id: 'item-1' }) },
      workItemAssignee: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      workItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-1',
          type: WorkItemType.STORY,
          status: WorkItemStatus.TODO,
          parentId: null,
        }),
      },
      projectMember: { count: jest.fn().mockResolvedValue(2) },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      {} as ConstructorParameters<typeof WorkItemsService>[1],
    );
    jest.spyOn(service, 'getById').mockResolvedValue({} as WorkItemDetail);

    await service.update('project-1', 'item-1', { assigneeIds: [USER_TWO, USER_ONE] });

    expect(tx.workItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assigneeId: USER_TWO }) }),
    );
    expect(tx.workItemAssignee.deleteMany).toHaveBeenCalledWith({
      where: { workItemId: 'item-1' },
    });
    expect(tx.workItemAssignee.createMany).toHaveBeenCalledWith({
      data: [
        { workItemId: 'item-1', userId: USER_TWO },
        { workItemId: 'item-1', userId: USER_ONE },
      ],
      skipDuplicates: true,
    });
  });
});

describe('WorkItemsService — fermeture en cascade', () => {
  it('passe les descendants non termines a DONE quand update() cloture un epic', async () => {
    const tx = {
      workItem: {
        update: jest.fn().mockResolvedValue({ id: 'epic-1' }),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'story-1' }]) // enfants de epic-1
          .mockResolvedValueOnce([{ id: 'subtask-1' }]) // enfants de story-1
          .mockResolvedValueOnce([]), // enfants de subtask-1
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      workItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'epic-1',
          type: WorkItemType.EPIC,
          status: WorkItemStatus.IN_PROGRESS,
          parentId: null,
        }),
      },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      {} as ConstructorParameters<typeof WorkItemsService>[1],
    );
    jest.spyOn(service, 'getById').mockResolvedValue({} as WorkItemDetail);

    await service.update('project-1', 'epic-1', { status: WorkItemStatus.DONE });

    expect(tx.workItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['story-1', 'subtask-1'] }, status: { not: WorkItemStatus.DONE } },
      data: { status: WorkItemStatus.DONE, closedAt: expect.any(Date) },
    });
  });

  it('ne touche a rien quand update() ne change pas le statut vers DONE', async () => {
    const tx = { workItem: { update: jest.fn().mockResolvedValue({ id: 'story-1' }) } };
    const prisma = {
      workItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'story-1',
          type: WorkItemType.STORY,
          status: WorkItemStatus.TODO,
          parentId: 'epic-1',
        }),
      },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      {} as ConstructorParameters<typeof WorkItemsService>[1],
    );
    jest.spyOn(service, 'getById').mockResolvedValue({} as WorkItemDetail);

    await service.update('project-1', 'story-1', { priority: Priority.HIGH });

    // Pas de findMany/updateMany sur tx : aucune tentative de cascade.
    expect(Object.keys(tx.workItem)).toEqual(['update']);
  });

  it('cascade aussi depuis move() (deplacement board vers la colonne Terminé)', async () => {
    const txMove = {
      workItem: {
        update: jest.fn().mockResolvedValue({ id: 'story-1' }),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'subtask-1' }])
          .mockResolvedValueOnce([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const fakeRow = {
      id: 'story-1',
      projectId: 'project-1',
      number: 2,
      type: WorkItemType.STORY,
      parent: null,
      title: 'Story',
      status: WorkItemStatus.DONE,
      priority: Priority.MEDIUM,
      storyPoints: 3,
      rank: 'm',
      boardRank: 'z9',
      isBlocked: false,
      blockedReason: null,
      parentId: 'epic-1',
      sprintId: null,
      startDate: null,
      dueDate: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      assignee: null,
      assignees: [],
      reporter: { id: 'u1', name: 'Reporter', email: 'r@x.com', avatarUrl: null },
      labels: [],
      project: { key: 'VIS' },
    };
    const prisma = {
      workItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'story-1',
          type: WorkItemType.STORY,
          status: WorkItemStatus.IN_PROGRESS,
          parentId: 'epic-1',
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(fakeRow),
      },
      $transaction: jest.fn((operation: (client: typeof txMove) => unknown) => operation(txMove)),
    };
    const ranking = { computeRank: jest.fn().mockResolvedValue('z9') };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      ranking as unknown as ConstructorParameters<typeof WorkItemsService>[1],
    );

    await service.move('project-1', 'story-1', { status: WorkItemStatus.DONE });

    expect(txMove.workItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['subtask-1'] }, status: { not: WorkItemStatus.DONE } },
      data: { status: WorkItemStatus.DONE, closedAt: expect.any(Date) },
    });
  });
});

describe('WorkItemsService — propagation Epic → Sprint', () => {
  const EPIC = {
    id: 'epic-1',
    type: WorkItemType.EPIC,
    status: WorkItemStatus.IN_PROGRESS,
    parentId: null,
    sprintId: null,
  };

  /** children of epic-1 → ['story-1'] ; children of story-1 → [] (feuille). */
  function hierarchyFindMany(descendantDetails: Record<string, unknown>[]) {
    return jest.fn((args: { where: { parentId?: { in: string[] }; id?: { in: string[] } } }) => {
      if (args.where.parentId) {
        if (args.where.parentId.in.includes('epic-1')) return Promise.resolve([{ id: 'story-1' }]);
        return Promise.resolve([]);
      }
      return Promise.resolve(descendantDetails);
    });
  }

  function baseDescendant(overrides: Record<string, unknown>) {
    return {
      id: 'story-1',
      title: 'Story fille',
      sprintId: null,
      sprint: null,
      number: 2,
      type: WorkItemType.STORY,
      parent: null,
      project: { key: 'VIS' },
      ...overrides,
    };
  }

  it('cascade automatiquement vers des descendants sans conflit, sans demander de confirmation', async () => {
    const tx = {
      workItem: {
        update: jest.fn().mockResolvedValue({ id: 'epic-1' }),
        findMany: hierarchyFindMany([baseDescendant({ sprintId: null })]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      workItem: { findFirst: jest.fn().mockResolvedValue(EPIC) },
      sprint: { findFirst: jest.fn().mockResolvedValue({ id: 'sprint-1' }) },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      {} as ConstructorParameters<typeof WorkItemsService>[1],
    );
    jest.spyOn(service, 'getById').mockResolvedValue({} as WorkItemDetail);

    await service.update('project-1', 'epic-1', { sprintId: 'sprint-1' });

    expect(tx.workItem.update).toHaveBeenCalled();
    expect(tx.workItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['story-1'] } },
      data: { sprintId: 'sprint-1' },
    });
  });

  it('refuse silencieusement de deplacer un descendant deja dans un AUTRE sprint sans confirmation', async () => {
    const tx = {
      workItem: {
        update: jest.fn().mockResolvedValue({ id: 'epic-1' }),
        findMany: hierarchyFindMany([
          baseDescendant({ sprintId: 'sprint-other', sprint: { name: 'Sprint Autre' } }),
        ]),
        updateMany: jest.fn(),
      },
    };
    const prisma = {
      workItem: { findFirst: jest.fn().mockResolvedValue(EPIC) },
      sprint: { findFirst: jest.fn().mockResolvedValue({ id: 'sprint-1' }) },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      {} as ConstructorParameters<typeof WorkItemsService>[1],
    );

    await expect(
      service.update('project-1', 'epic-1', { sprintId: 'sprint-1' }),
    ).rejects.toMatchObject({
      response: {
        code: 'SPRINT_PROPAGATION_CONFIRMATION_REQUIRED',
        details: {
          conflicts: [
            expect.objectContaining({
              id: 'story-1',
              key: 'VIS-US-2',
              currentSprintId: 'sprint-other',
              currentSprintName: 'Sprint Autre',
            }),
          ],
        },
      },
    });
    // Rien n'est ecrit : ni la mise a jour de l'Epic, ni la cascade.
    expect(tx.workItem.update).not.toHaveBeenCalled();
    expect(tx.workItem.updateMany).not.toHaveBeenCalled();
  });

  it('cascade vers TOUS les descendants, y compris ceux en conflit, une fois confirme', async () => {
    const tx = {
      workItem: {
        update: jest.fn().mockResolvedValue({ id: 'epic-1' }),
        findMany: hierarchyFindMany([
          baseDescendant({ sprintId: 'sprint-other', sprint: { name: 'Sprint Autre' } }),
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      workItem: { findFirst: jest.fn().mockResolvedValue(EPIC) },
      sprint: { findFirst: jest.fn().mockResolvedValue({ id: 'sprint-1' }) },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      {} as ConstructorParameters<typeof WorkItemsService>[1],
    );
    jest.spyOn(service, 'getById').mockResolvedValue({} as WorkItemDetail);

    await service.update('project-1', 'epic-1', {
      sprintId: 'sprint-1',
      confirmSprintPropagation: true,
    });

    expect(tx.workItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['story-1'] } },
      data: { sprintId: 'sprint-1' },
    });
  });

  it('ne declenche aucune verification quand un ticket non-Epic change de sprint', async () => {
    const tx = { workItem: { update: jest.fn().mockResolvedValue({ id: 'story-1' }) } };
    const prisma = {
      workItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'story-1',
          type: WorkItemType.STORY,
          status: WorkItemStatus.TODO,
          parentId: 'epic-1',
          sprintId: null,
        }),
      },
      sprint: { findFirst: jest.fn().mockResolvedValue({ id: 'sprint-1' }) },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      {} as ConstructorParameters<typeof WorkItemsService>[1],
    );
    jest.spyOn(service, 'getById').mockResolvedValue({} as WorkItemDetail);

    await service.update('project-1', 'story-1', { sprintId: 'sprint-1' });

    // Pas de findMany sur tx : aucune tentative de resolution de conflit pour une Story.
    expect(Object.keys(tx.workItem)).toEqual(['update']);
  });
});

describe('WorkItemsService — heritage du sprint du parent', () => {
  const EPIC_IN_SPRINT = { type: WorkItemType.EPIC };

  function buildCreateService(options: { parentSprintId: string | null }) {
    const tx = {
      workItem: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'new-story' }),
      },
    };
    const prisma = {
      workItem: {
        findFirst: jest.fn().mockResolvedValue(EPIC_IN_SPRINT),
        findUnique: jest.fn().mockResolvedValue({ sprintId: options.parentSprintId }),
      },
      sprint: { findFirst: jest.fn().mockResolvedValue({ id: 'sprint-2' }) },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const ranking = { initialRanks: jest.fn().mockResolvedValue({ rank: 'a0', boardRank: 'b0' }) };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      ranking as unknown as ConstructorParameters<typeof WorkItemsService>[1],
    );
    jest.spyOn(service, 'getById').mockResolvedValue({} as WorkItemDetail);
    return { service, prisma, tx };
  }

  it("une Story creee sous un Epic planifie rejoint le sprint de l'Epic", async () => {
    const { service, tx } = buildCreateService({ parentSprintId: 'sprint-1' });

    await service.create(
      'project-1',
      {
        type: WorkItemType.STORY,
        title: 'Story fille',
        priority: Priority.MEDIUM,
        parentId: 'epic-1',
      },
      'reporter-1',
    );

    expect(tx.workItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sprintId: 'sprint-1' }) }),
    );
  });

  it('respecte le choix explicite du backlog sous un parent planifie', async () => {
    const { service, tx } = buildCreateService({ parentSprintId: 'sprint-1' });
    await service.create(
      'project-1',
      {
        type: WorkItemType.STORY,
        title: 'Story backlog',
        priority: Priority.MEDIUM,
        parentId: 'epic-1',
        sprintId: null,
      },
      'reporter-1',
    );
    expect(tx.workItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sprintId: null }) }),
    );
  });

  it('un sprint choisi explicitement a la creation est respecte', async () => {
    const { service, prisma, tx } = buildCreateService({ parentSprintId: 'sprint-1' });

    await service.create(
      'project-1',
      {
        type: WorkItemType.STORY,
        title: 'Story fille',
        priority: Priority.MEDIUM,
        parentId: 'epic-1',
        sprintId: 'sprint-2',
      },
      'reporter-1',
    );

    expect(prisma.workItem.findUnique).not.toHaveBeenCalled();
    expect(tx.workItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sprintId: 'sprint-2' }) }),
    );
  });

  /** story-1 → subtask-1 → (feuille) ; toute autre requête de numérotation → aucun numéro pris. */
  function treeFindMany() {
    return jest.fn((args: { where: { parentId?: unknown } }) => {
      const parentFilter = args.where.parentId as { in?: string[] } | string | undefined;
      if (parentFilter && typeof parentFilter === 'object' && parentFilter.in) {
        return Promise.resolve(parentFilter.in.includes('story-1') ? [{ id: 'subtask-1' }] : []);
      }
      return Promise.resolve([]);
    });
  }

  function buildReparentService(storySprintId: string | null) {
    const tx = {
      workItem: {
        findMany: treeFindMany(),
        update: jest.fn().mockResolvedValue({ id: 'story-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      workItem: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'story-1',
            type: WorkItemType.STORY,
            status: WorkItemStatus.TODO,
            parentId: null,
            sprintId: storySprintId,
          })
          .mockResolvedValueOnce(EPIC_IN_SPRINT),
        findMany: treeFindMany(),
        findUnique: jest.fn().mockResolvedValue({ sprintId: 'sprint-1' }),
      },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const ranking = { computeRank: jest.fn().mockResolvedValue('r1') };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      ranking as unknown as ConstructorParameters<typeof WorkItemsService>[1],
    );
    jest.spyOn(service, 'getById').mockResolvedValue({} as WorkItemDetail);
    return { service, prisma, tx };
  }

  it("rattacher une Story du backlog a un Epic planifie lui donne, ainsi qu'a ses sous-taches, le sprint de l'Epic", async () => {
    const { service, tx } = buildReparentService(null);

    await service.update('project-1', 'story-1', { parentId: 'epic-1' });

    expect(tx.workItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentId: 'epic-1', sprintId: 'sprint-1' }),
      }),
    );
    expect(tx.workItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['subtask-1'] }, sprintId: null },
      data: { sprintId: 'sprint-1' },
    });
  });

  it("n'ecrase jamais le sprint d'une Story deja planifiee lors d'un rattachement", async () => {
    const { service, prisma, tx } = buildReparentService('sprint-9');

    await service.update('project-1', 'story-1', { parentId: 'epic-1' });

    expect(prisma.workItem.findUnique).not.toHaveBeenCalled();
    const data = tx.workItem.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty('sprintId');
    expect(tx.workItem.updateMany).not.toHaveBeenCalled();
  });
});

describe('WorkItemsService — renumerotation (reorder)', () => {
  it('un reorder renumerote les freres dans la meme transaction', async () => {
    const tx = {
      workItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'item-1', number: 12 },
          { id: 'sibling', number: 1 },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
      workItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-1',
          type: WorkItemType.STORY,
          status: WorkItemStatus.TODO,
          parentId: 'epic-1',
        }),
        update: jest.fn().mockResolvedValue({ id: 'item-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'item-1',
          projectId: 'project-1',
          number: 12,
          type: WorkItemType.STORY,
          parent: null,
          title: 'US-12',
          status: WorkItemStatus.TODO,
          priority: Priority.MEDIUM,
          storyPoints: null,
          rank: 'm',
          boardRank: 'b',
          isBlocked: false,
          blockedReason: null,
          parentId: 'epic-1',
          sprintId: null,
          startDate: null,
          dueDate: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          assignee: null,
          assignees: [],
          reporter: { id: 'u1', name: 'Reporter', email: 'r@x.com', avatarUrl: null },
          labels: [],
          project: { key: 'VIS' },
        }),
      },
    };
    const ranking = { computeRank: jest.fn().mockResolvedValue('m5') };
    const service = new WorkItemsService(
      prisma as unknown as ConstructorParameters<typeof WorkItemsService>[0],
      ranking as unknown as ConstructorParameters<typeof WorkItemsService>[1],
    );

    await service.move('project-1', 'item-1', { beforeId: 'before-1', afterId: 'after-1' });

    expect(prisma.workItem.update).not.toHaveBeenCalled();
    expect(tx.workItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { rank: 'm5' },
    });
    expect(tx.workItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { number: 1 },
    });
    expect(tx.workItem.update).toHaveBeenCalledWith({
      where: { id: 'sibling' },
      data: { number: 2 },
    });
  });
});

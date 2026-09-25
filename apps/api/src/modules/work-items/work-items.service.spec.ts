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

  it("ne touche a rien quand update() ne change pas le statut vers DONE", async () => {
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
        findMany: jest.fn().mockResolvedValueOnce([{ id: 'subtask-1' }]).mockResolvedValueOnce([]),
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

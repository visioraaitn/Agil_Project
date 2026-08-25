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

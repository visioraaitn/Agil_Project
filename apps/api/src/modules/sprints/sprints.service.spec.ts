import { SprintStatus, WorkItemStatus } from '@visiora/shared';
import { SprintsService } from './sprints.service';

describe('SprintsService.update', () => {
  it('refuse de démarrer un second sprint dans le même projet', async () => {
    const plannedSprint = {
      id: 'sprint-planned',
      status: SprintStatus.PLANNED,
      startDate: new Date('2026-08-25T00:00:00.000Z'),
      endDate: new Date('2026-09-05T00:00:00.000Z'),
    };
    const prisma = {
      sprint: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(plannedSprint)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'sprint-active' }),
        update: jest.fn(),
      },
    };
    const service = new SprintsService(
      prisma as unknown as ConstructorParameters<typeof SprintsService>[0],
    );

    await expect(
      service.update('project-1', plannedSprint.id, { status: SprintStatus.ACTIVE }),
    ).rejects.toMatchObject({ response: { code: 'ACTIVE_SPRINT_EXISTS' } });
    expect(prisma.sprint.update).not.toHaveBeenCalled();
  });
});

describe('SprintsService.close', () => {
  const PROJECT_ID = 'project-1';
  const SPRINT_ID = 'sprint-1';

  function buildService(options: {
    sprintFindFirstResults: unknown[];
    items: { id: string; storyPoints: number | null; status: string }[];
  }) {
    const tx = {
      workItem: {
        findMany: jest.fn().mockResolvedValue(options.items),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      sprint: { update: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      sprint: {
        findFirst: jest.fn(
          (): unknown => options.sprintFindFirstResults.shift() ?? null,
        ),
      },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const service = new SprintsService(
      prisma as unknown as ConstructorParameters<typeof SprintsService>[0],
    );
    jest.spyOn(service, 'getById').mockResolvedValue({} as Awaited<ReturnType<typeof service.getById>>);
    return { service, prisma, tx };
  }

  it('cloture sans element non termine : aucun deplacement, aucune cible requise', async () => {
    const { service, tx } = buildService({
      sprintFindFirstResults: [{ id: SPRINT_ID, status: SprintStatus.ACTIVE }],
      items: [
        { id: 'item-1', storyPoints: 5, status: WorkItemStatus.DONE },
        { id: 'item-2', storyPoints: 3, status: WorkItemStatus.DONE },
      ],
    });

    await service.close(PROJECT_ID, SPRINT_ID, {});

    expect(tx.workItem.updateMany).not.toHaveBeenCalled();
    expect(tx.sprint.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SprintStatus.COMPLETED,
          committedPoints: 8,
          completedPoints: 8,
        }),
      }),
    );
  });

  it('refuse de cloturer sans sprint cible quand des elements ne sont pas termines', async () => {
    const { service, tx } = buildService({
      sprintFindFirstResults: [{ id: SPRINT_ID, status: SprintStatus.ACTIVE }],
      items: [{ id: 'item-1', storyPoints: 5, status: WorkItemStatus.TODO }],
    });

    await expect(service.close(PROJECT_ID, SPRINT_ID, {})).rejects.toMatchObject({
      response: { code: 'TARGET_SPRINT_REQUIRED' },
    });
    expect(tx.sprint.update).not.toHaveBeenCalled();
  });

  it('deplace uniquement les elements non termines vers le sprint cible, tous types confondus', async () => {
    const TARGET_ID = 'sprint-2';
    const { service, tx } = buildService({
      sprintFindFirstResults: [
        { id: SPRINT_ID, status: SprintStatus.ACTIVE },
        { status: SprintStatus.PLANNED },
      ],
      items: [
        { id: 'story-done', storyPoints: 5, status: WorkItemStatus.DONE },
        { id: 'bug-open', storyPoints: 2, status: WorkItemStatus.IN_PROGRESS },
        { id: 'subtask-open', storyPoints: null, status: WorkItemStatus.TODO },
      ],
    });

    await service.close(PROJECT_ID, SPRINT_ID, { targetSprintId: TARGET_ID });

    expect(tx.workItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['bug-open', 'subtask-open'] } },
      data: { sprintId: TARGET_ID },
    });
    expect(tx.sprint.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ committedPoints: 7, completedPoints: 5 }),
      }),
    );
  });

  it('refuse un sprint cible identique au sprint cloture', async () => {
    const { service } = buildService({
      sprintFindFirstResults: [{ id: SPRINT_ID, status: SprintStatus.ACTIVE }],
      items: [{ id: 'item-1', storyPoints: 1, status: WorkItemStatus.TODO }],
    });

    await expect(
      service.close(PROJECT_ID, SPRINT_ID, { targetSprintId: SPRINT_ID }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_TARGET_SPRINT' } });
  });

  it('refuse un sprint cible deja cloture', async () => {
    const { service } = buildService({
      sprintFindFirstResults: [
        { id: SPRINT_ID, status: SprintStatus.ACTIVE },
        { status: SprintStatus.COMPLETED },
      ],
      items: [{ id: 'item-1', storyPoints: 1, status: WorkItemStatus.TODO }],
    });

    await expect(
      service.close(PROJECT_ID, SPRINT_ID, { targetSprintId: 'sprint-2' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_TARGET_SPRINT' } });
  });

  it("refuse un sprint cible hors du projet", async () => {
    const { service } = buildService({
      sprintFindFirstResults: [{ id: SPRINT_ID, status: SprintStatus.ACTIVE }, null],
      items: [{ id: 'item-1', storyPoints: 1, status: WorkItemStatus.TODO }],
    });

    await expect(
      service.close(PROJECT_ID, SPRINT_ID, { targetSprintId: 'sprint-2' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_TARGET_SPRINT' } });
  });
});

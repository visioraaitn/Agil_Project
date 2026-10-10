import {
  SprintStatus,
  UnfinishedItemsAction,
  WorkItemStatus,
  startOfUtcDay,
} from '@visiora/shared';
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
        // Dates inchangées : pas de contrôle de chevauchement, seulement le sprint actif.
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(plannedSprint)
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
        findFirst: jest.fn((): unknown => options.sprintFindFirstResults.shift() ?? null),
      },
      $transaction: jest.fn((operation: (client: typeof tx) => unknown) => operation(tx)),
    };
    const service = new SprintsService(
      prisma as unknown as ConstructorParameters<typeof SprintsService>[0],
    );
    jest
      .spyOn(service, 'getById')
      .mockResolvedValue({} as Awaited<ReturnType<typeof service.getById>>);
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

  it('refuse de cloturer sans choix explicite quand des elements ne sont pas termines', async () => {
    const { service, tx } = buildService({
      sprintFindFirstResults: [{ id: SPRINT_ID, status: SprintStatus.ACTIVE }],
      items: [{ id: 'item-1', storyPoints: 5, status: WorkItemStatus.TODO }],
    });

    await expect(service.close(PROJECT_ID, SPRINT_ID, {})).rejects.toMatchObject({
      response: { code: 'UNFINISHED_ITEMS_ACTION_REQUIRED' },
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

    await service.close(PROJECT_ID, SPRINT_ID, {
      unfinishedItemsAction: UnfinishedItemsAction.MOVE_TO_SPRINT,
      targetSprintId: TARGET_ID,
    });

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

  it('remet les elements non termines au backlog (sprintId null) sans toucher parentId', async () => {
    const { service, tx } = buildService({
      sprintFindFirstResults: [{ id: SPRINT_ID, status: SprintStatus.ACTIVE }],
      items: [
        { id: 'epic-open', storyPoints: null, status: WorkItemStatus.IN_PROGRESS },
        { id: 'story-done', storyPoints: 5, status: WorkItemStatus.DONE },
      ],
    });

    await service.close(PROJECT_ID, SPRINT_ID, {
      unfinishedItemsAction: UnfinishedItemsAction.BACKLOG,
    });

    expect(tx.workItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['epic-open'] } },
      data: { sprintId: null },
    });
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

  it('refuse un sprint cible hors du projet', async () => {
    const { service } = buildService({
      sprintFindFirstResults: [{ id: SPRINT_ID, status: SprintStatus.ACTIVE }, null],
      items: [{ id: 'item-1', storyPoints: 1, status: WorkItemStatus.TODO }],
    });

    await expect(
      service.close(PROJECT_ID, SPRINT_ID, { targetSprintId: 'sprint-2' }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_TARGET_SPRINT' } });
  });
});

describe('SprintsService — règles de dates', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const today = startOfUtcDay();
  const inDays = (days: number) => new Date(today.getTime() + days * DAY);

  function serviceWith(findFirst: jest.Mock) {
    const prisma = {
      sprint: { findFirst, create: jest.fn().mockResolvedValue({ id: 'new' }), update: jest.fn() },
    };
    const service = new SprintsService(
      prisma as unknown as ConstructorParameters<typeof SprintsService>[0],
    );
    jest
      .spyOn(service, 'getById')
      .mockResolvedValue({} as Awaited<ReturnType<typeof service.getById>>);
    return { service, prisma };
  }

  it('refuse un sprint qui commence avant aujourd’hui', async () => {
    const { service, prisma } = serviceWith(jest.fn());
    await expect(
      service.create('p', { name: 'S', startDate: inDays(-1), endDate: inDays(10) }),
    ).rejects.toMatchObject({ response: { code: 'SPRINT_START_IN_PAST' } });
    expect(prisma.sprint.create).not.toHaveBeenCalled();
  });

  it('accepte un sprint qui commence aujourd’hui', async () => {
    const { service, prisma } = serviceWith(jest.fn().mockResolvedValue(null));
    await service.create('p', { name: 'S', startDate: today, endDate: inDays(13) });
    expect(prisma.sprint.create).toHaveBeenCalled();
  });

  it('refuse des dates qui chevauchent un autre sprint, même clôturé, en le nommant', async () => {
    const overlap = { name: 'Sprint 4', startDate: inDays(2), endDate: inDays(15) };
    const findFirst = jest.fn().mockResolvedValue(overlap);
    const { service } = serviceWith(findFirst);

    await expect(
      service.create('p', { name: 'S', startDate: inDays(10), endDate: inDays(20) }),
    ).rejects.toMatchObject({
      response: { code: 'SPRINT_DATES_OVERLAP', message: expect.stringContaining('Sprint 4') },
    });
    // Aucun filtre sur le statut : un sprint clôturé bloque aussi ses dates.
    expect(findFirst.mock.calls[0][0].where.status).toBeUndefined();
  });

  it('modifie le nom d’un sprint actif commencé dans le passé sans contrôler ses dates', async () => {
    const existing = {
      id: 's',
      status: SprintStatus.ACTIVE,
      startDate: inDays(-5),
      endDate: inDays(5),
    };
    const findFirst = jest.fn().mockResolvedValueOnce(existing);
    const { service, prisma } = serviceWith(findFirst);

    await service.update('p', 's', {
      name: 'Nouveau nom',
      startDate: inDays(-5),
      endDate: inDays(5),
    });

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.sprint.update).toHaveBeenCalled();
  });

  it('prolonge un sprint actif, mais refuse de déplacer son début dans le passé', async () => {
    const existing = {
      id: 's',
      status: SprintStatus.ACTIVE,
      startDate: inDays(-5),
      endDate: inDays(5),
    };
    const extend = serviceWith(
      jest.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(null),
    );
    await extend.service.update('p', 's', { endDate: inDays(9) });
    expect(extend.prisma.sprint.update).toHaveBeenCalled();

    const moveStart = serviceWith(jest.fn().mockResolvedValueOnce(existing));
    await expect(
      moveStart.service.update('p', 's', { startDate: inDays(-7) }),
    ).rejects.toMatchObject({
      response: { code: 'SPRINT_START_IN_PAST' },
    });
  });
});

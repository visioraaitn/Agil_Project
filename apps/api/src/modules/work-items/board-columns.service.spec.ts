import { WorkItemStatus } from '@visiora/shared';
import { BoardColumnsService } from './board-columns.service';

const PROJECT = 'project-1';

function column(
  id: string,
  status: WorkItemStatus,
  position: number,
  isDefault: boolean,
  name = id,
) {
  return {
    id,
    projectId: PROJECT,
    name,
    status,
    systemStatus: isDefault ? status : null,
    position,
    wipLimit: null,
    isVisible: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

const DEFAULTS = [
  column('todo', WorkItemStatus.TODO, 0, true),
  column('progress', WorkItemStatus.IN_PROGRESS, 1, true),
  column('test', WorkItemStatus.IN_TEST, 2, true),
  column('ready', WorkItemStatus.READY_FOR_APPROVAL, 3, true),
  column('done', WorkItemStatus.DONE, 4, true),
];
const REVIEW = column('review', WorkItemStatus.IN_PROGRESS, 5, false, 'Review');

function prismaWith(rows: ReturnType<typeof column>[]) {
  const client = {
    boardColumn: {
      count: jest.fn(({ where }: { where: { systemStatus?: unknown } }) =>
        Promise.resolve(where.systemStatus ? rows.filter((r) => r.systemStatus).length : rows.length),
      ),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue(rows),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    workItem: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  client.$transaction.mockImplementation((operation: (tx: typeof client) => unknown) =>
    operation(client),
  );
  return client;
}

function serviceWith(rows: ReturnType<typeof column>[]) {
  const prisma = prismaWith(rows);
  const service = new BoardColumnsService(
    prisma as unknown as ConstructorParameters<typeof BoardColumnsService>[0],
  );
  return { prisma, service };
}

describe('BoardColumnsService — résolution de colonne', () => {
  it('place un ticket dans une seule colonne, même quand deux colonnes partagent son statut', async () => {
    const { service } = serviceWith([...DEFAULTS, REVIEW]);
    const resolver = await service.resolver(PROJECT);

    expect(
      resolver.resolve({ status: WorkItemStatus.IN_PROGRESS, boardColumnId: null }).id,
    ).toBe('progress');
    expect(
      resolver.resolve({ status: WorkItemStatus.IN_PROGRESS, boardColumnId: 'review' }).id,
    ).toBe('review');
  });

  it('ignore une colonne personnalisée qui ne porte plus le statut du ticket', async () => {
    const { service } = serviceWith([...DEFAULTS, REVIEW]);
    const resolver = await service.resolver(PROJECT);

    // Statut changé hors du board (détail, PR) : retour à la colonne par défaut.
    expect(resolver.resolve({ status: WorkItemStatus.DONE, boardColumnId: 'review' }).id).toBe(
      'done',
    );
  });

  it('crée les colonnes par défaut au premier accès', async () => {
    const { prisma, service } = serviceWith([]);
    await service.list(PROJECT);

    expect(prisma.boardColumn.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    const created = prisma.boardColumn.createMany.mock.calls[0][0].data;
    expect(created.map((row: { systemStatus: string }) => row.systemStatus)).toEqual([
      WorkItemStatus.TODO,
      WorkItemStatus.IN_PROGRESS,
      WorkItemStatus.IN_TEST,
      WorkItemStatus.READY_FOR_APPROVAL,
      WorkItemStatus.DONE,
    ]);
  });
});

describe('BoardColumnsService — enregistrement', () => {
  const asInput = (rows: ReturnType<typeof column>[]) =>
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      wipLimit: null,
      isVisible: true,
    }));

  it("enregistre l'ordre envoyé et supprime la colonne personnalisée retirée", async () => {
    const { prisma, service } = serviceWith([...DEFAULTS, REVIEW]);
    const reordered = [DEFAULTS[0], DEFAULTS[2], DEFAULTS[1], DEFAULTS[3], DEFAULTS[4]];

    await service.save(PROJECT, { columns: asInput(reordered) });

    expect(prisma.boardColumn.deleteMany).toHaveBeenCalledWith({
      where: { projectId: PROJECT, id: { in: ['review'] } },
    });
    const positions = prisma.boardColumn.update.mock.calls.map(
      ([call]: [{ where: { id: string }; data: { position: number } }]) => [
        call.where.id,
        call.data.position,
      ],
    );
    expect(positions).toEqual([
      ['todo', 0],
      ['test', 1],
      ['progress', 2],
      ['ready', 3],
      ['done', 4],
    ]);
  });

  it('refuse de supprimer une colonne par défaut', async () => {
    const { service } = serviceWith(DEFAULTS);

    await expect(
      service.save(PROJECT, { columns: asInput(DEFAULTS.slice(1)) }),
    ).rejects.toMatchObject({ response: { code: 'BOARD_DEFAULT_COLUMN_REQUIRED' } });
  });

  it("garde le statut d'une colonne par défaut et crée les nouvelles colonnes", async () => {
    const { prisma, service } = serviceWith(DEFAULTS);
    const input = asInput(DEFAULTS);
    input[1] = { ...input[1], status: WorkItemStatus.DONE } as (typeof input)[number];

    await service.save(PROJECT, {
      columns: [
        ...input,
        { name: 'QA', status: WorkItemStatus.IN_TEST, wipLimit: 3, isVisible: true },
      ],
    });

    const progressUpdate = prisma.boardColumn.update.mock.calls.find(
      ([call]: [{ where: { id: string } }]) => call.where.id === 'progress',
    );
    expect(progressUpdate[0].data.status).toBe(WorkItemStatus.IN_PROGRESS);
    expect(prisma.boardColumn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'QA', status: WorkItemStatus.IN_TEST, position: 5 }),
    });
  });
});

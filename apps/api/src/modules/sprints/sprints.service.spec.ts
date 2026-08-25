import { SprintStatus } from '@visiora/shared';
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

import { ProjectsService } from './projects.service';
import { NotificationType } from '@visiora/shared';

describe('ProjectsService.addMember', () => {
  it('envoie une notification et un email quand un membre est ajouté au projet', async () => {
    const user = { id: 'user-2', isActive: true };
    const project = { id: 'project-1', name: 'VisioraAI' };
    const createdMember = {
      id: 'member-1',
      role: 'DEVELOPER',
      capacity: null,
      joinedAt: new Date(),
      user: {
        id: 'user-2',
        name: 'Nour Hamdi',
        email: 'nour@example.com',
        avatarUrl: null,
        isActive: true,
      },
    };

    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue(project),
      },
      projectMember: {
        create: jest.fn().mockResolvedValue(createdMember),
      },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
        update: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      },
    };

    const access = {};
    const email = {
      sendNotification: jest.fn().mockResolvedValue(true),
    };

    const service = new ProjectsService(
      prisma as unknown as ConstructorParameters<typeof ProjectsService>[0],
      access as unknown as ConstructorParameters<typeof ProjectsService>[1],
      email as unknown as ConstructorParameters<typeof ProjectsService>[2],
    );

    await service.addMember('project-1', { userId: 'user-2', role: 'DEVELOPER', capacity: null });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-2',
          projectId: 'project-1',
          type: NotificationType.PROJECT_MEMBER_ADDED,
          title: expect.stringContaining('VisioraAI'),
        }),
      }),
    );
    expect(email.sendNotification).toHaveBeenCalledWith(
      'nour@example.com',
      expect.stringContaining('VisioraAI'),
      expect.any(String),
    );
  });
});

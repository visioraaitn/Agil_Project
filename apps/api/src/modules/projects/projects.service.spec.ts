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
    const storage = { deleteObject: jest.fn() };

    const service = new ProjectsService(
      prisma as unknown as ConstructorParameters<typeof ProjectsService>[0],
      access as unknown as ConstructorParameters<typeof ProjectsService>[1],
      email as unknown as ConstructorParameters<typeof ProjectsService>[2],
      storage as unknown as ConstructorParameters<typeof ProjectsService>[3],
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

describe('ProjectsService.remove', () => {
  const project = {
    name: 'Visiora Planner',
    documents: [{ storageKey: 'projects/p1/documents/a.pdf' }],
    workItems: [{ attachments: [{ storageKey: 'p1/w1/a.png' }] }],
  };

  function setup() {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(project),
        delete: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    };
    const storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
    const service = new ProjectsService(
      prisma as unknown as ConstructorParameters<typeof ProjectsService>[0],
      {} as ConstructorParameters<typeof ProjectsService>[1],
      {} as ConstructorParameters<typeof ProjectsService>[2],
      storage as unknown as ConstructorParameters<typeof ProjectsService>[3],
    );
    return { prisma, storage, service };
  }

  it('refuse la suppression si le nom de confirmation diffère', async () => {
    const { prisma, service } = setup();

    await expect(
      service.remove('project-1', { confirmationName: 'Autre projet' }),
    ).rejects.toMatchObject({ response: { code: 'PROJECT_CONFIRMATION_MISMATCH' } });
    expect(prisma.project.delete).not.toHaveBeenCalled();
  });

  it('supprime le projet puis nettoie ses objets de stockage', async () => {
    const { prisma, storage, service } = setup();

    await service.remove('project-1', { confirmationName: project.name });

    expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id: 'project-1' } });
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
  });
});

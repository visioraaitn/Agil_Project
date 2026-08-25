import { ProjectsService } from './projects.service';
import { GlobalRole, NotificationType, ProjectStatus } from '@visiora/shared';

describe('ProjectsService.getById', () => {
  const project = {
    id: 'project-1',
    key: 'VIS',
    name: 'visioPlanner',
    description: null,
    company: null,
    status: ProjectStatus.ACTIVE,
    startDate: null,
    targetDate: null,
    color: null,
    createdAt: new Date('2026-08-25T00:00:00.000Z'),
    _count: { members: 1 },
  };
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User Test',
    jobTitle: null,
    avatarUrl: null,
    globalRole: GlobalRole.MEMBER,
    isSuperAdmin: false,
  };

  function setup(activeSprint: { id: string; name: string } | null) {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          ...project,
          sprints: activeSprint ? [activeSprint] : [],
        }),
      },
    };
    const access = { getProjectRole: jest.fn().mockResolvedValue(null) };
    const service = new ProjectsService(
      prisma as unknown as ConstructorParameters<typeof ProjectsService>[0],
      access as unknown as ConstructorParameters<typeof ProjectsService>[1],
      {} as ConstructorParameters<typeof ProjectsService>[2],
      {} as ConstructorParameters<typeof ProjectsService>[3],
    );
    return service;
  }

  it('affiche automatiquement un projet sans sprint actif comme étant en pause', async () => {
    const result = await setup(null).getById(user, project.id);

    expect(result.effectiveStatus).toBe(ProjectStatus.ON_HOLD);
    expect(result.activeSprint).toBeNull();
  });

  it('affiche le nom du sprint courant pour un projet en cours', async () => {
    const activeSprint = { id: 'sprint-1', name: 'Sprint 4' };
    const result = await setup(activeSprint).getById(user, project.id);

    expect(result.effectiveStatus).toBe(ProjectStatus.ACTIVE);
    expect(result.activeSprint).toEqual(activeSprint);
  });
});

describe('ProjectsService.addMember', () => {
  it('envoie une notification et un email quand un membre est ajouté au projet', async () => {
    const user = { id: 'user-2', isActive: true };
    const project = { id: 'project-1', name: 'VisioraAI' };
    const createdMember = {
      id: 'member-1',
      role: 'MEMBER',
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

    await service.addMember('project-1', { userId: 'user-2', role: 'MEMBER', capacity: null });

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

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AddProjectMemberInput,
  AuthenticatedUser,
  CreateProjectInput,
  DeleteProjectInput,
  EntityType,
  ListProjectsQuery,
  NotificationType,
  Paginated,
  ProjectMemberSummary,
  ProjectRole,
  ProjectStatus,
  ProjectSummary,
  SprintStatus,
  UpdateProjectInput,
  UpdateProjectMemberInput,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { seedProjectTags } from '../../../prisma/default-tags';
import { seedProjectLabels } from '../../../prisma/default-labels';
import { ProjectAccessService, visibleProjectsWhere } from '../access/project-access.service';
import { EmailService } from '../collaboration/email.service';
import { ObjectStorageService } from '../storage/object-storage.service';

const PROJECT_FIELDS = {
  id: true,
  key: true,
  name: true,
  description: true,
  company: true,
  status: true,
  startDate: true,
  targetDate: true,
  color: true,
  createdAt: true,
  _count: { select: { members: true } },
  sprints: {
    where: { status: SprintStatus.ACTIVE },
    select: { id: true, name: true },
    orderBy: { startDate: 'desc' },
    take: 1,
  },
} satisfies Prisma.ProjectSelect;

type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_FIELDS }>;

const MEMBER_FIELDS = {
  id: true,
  role: true,
  capacity: true,
  joinedAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true, isActive: true } },
} satisfies Prisma.ProjectMemberSelect;

type MemberRow = Prisma.ProjectMemberGetPayload<{ select: typeof MEMBER_FIELDS }>;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly email: EmailService,
    private readonly storage: ObjectStorageService,
  ) {}

  /**
   * Seul le super administrateur voit tous les projets ; les autres — un
   * administrateur compris — ne voient que ceux dont ils sont membres. Le filtre
   * est dans la requête : la liste et son total ne révèlent aucun autre projet.
   */
  async list(
    user: AuthenticatedUser,
    query: ListProjectsQuery,
  ): Promise<Paginated<ProjectSummary>> {
    const scope =
      query.mine === true ? { members: { some: { userId: user.id } } } : visibleProjectsWhere(user);

    const where: Prisma.ProjectWhereInput = {
      ...scope,
      ...(query.status ? { AND: [projectStatusFilter(query.status)] } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { key: { contains: query.search.toUpperCase() } },
              { company: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        select: PROJECT_FIELDS,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const roles = await this.access.getRolesForProjects(
      user.id,
      rows.map((row) => row.id),
    );

    return {
      items: rows.map((row) => toProjectSummary(row, roles.get(row.id) ?? null)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async getById(user: AuthenticatedUser, projectId: string): Promise<ProjectSummary> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: PROJECT_FIELDS,
    });
    if (!project)
      throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: "Ce projet n'existe pas" });

    return toProjectSummary(project, await this.access.getProjectRole(user.id, projectId));
  }

  /** Le créateur devient Project Lead. La fonction Product Owner reste un
   * attribut du profil et n'est jamais utilisée pour autoriser une action. */
  async create(input: CreateProjectInput, creatorId: string): Promise<ProjectSummary> {
    const project = await this.prisma.project.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        company: input.company ?? null,
        startDate: input.startDate ?? null,
        targetDate: input.targetDate ?? null,
        color: input.color ?? null,
        createdById: creatorId,
        members: {
          create: { userId: creatorId, role: ProjectRole.PROJECT_LEAD },
        },
      },
      select: PROJECT_FIELDS,
    });

    await seedProjectTags(this.prisma, project.id);
    await seedProjectLabels(this.prisma, project.id);
    await this.audit(creatorId, project.id, project.id, 'created', {
      key: project.key,
      name: project.name,
    });

    return toProjectSummary(project, ProjectRole.PROJECT_LEAD);
  }

  async update(
    user: AuthenticatedUser,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectSummary> {
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.company !== undefined ? { company: input.company } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.status !== undefined
          ? {
              status: input.status,
              archivedAt: input.status === ProjectStatus.ARCHIVED ? new Date() : null,
            }
          : {}),
      },
      select: PROJECT_FIELDS,
    });

    return toProjectSummary(project, await this.access.getProjectRole(user.id, projectId));
  }

  async remove(projectId: string, input: DeleteProjectInput, actorId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        key: true,
        name: true,
        documents: { select: { storageKey: true } },
        workItems: {
          select: { attachments: { select: { storageKey: true } } },
        },
      },
    });
    if (!project) throw projectNotFound();
    if (input.confirmationName !== project.name) {
      throw new BadRequestException({
        code: 'PROJECT_CONFIRMATION_MISMATCH',
        message: 'Le nom saisi ne correspond pas au nom du projet',
      });
    }

    const storageKeys = [
      ...project.documents.map((document) => document.storageKey),
      ...project.workItems.flatMap((item) =>
        item.attachments.map((attachment) => attachment.storageKey),
      ),
    ];

    // La base est supprimée en premier : une panne S3 ne doit pas laisser un
    // projet partiellement supprimé et encore accessible. Les éventuels objets
    // orphelins sont inaccessibles et leur échec de nettoyage est journalisé.
    await this.prisma.project.delete({ where: { id: projectId } });
    // Journal détaché du projet : la suppression en cascade l'effacerait sinon.
    await this.audit(actorId, null, projectId, 'deleted', { key: project.key, name: project.name });
    const cleanup = await Promise.allSettled(
      storageKeys.map((storageKey) => this.storage.deleteObject(storageKey)),
    );
    const failures = cleanup.filter((result) => result.status === 'rejected').length;
    if (failures > 0) {
      this.logger.warn(
        `${failures} fichier(s) du projet ${projectId} n'ont pas pu être nettoyés du stockage`,
      );
    }
  }

  // --- Membres ------------------------------------------------------------

  async listMembers(projectId: string): Promise<ProjectMemberSummary[]> {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: MEMBER_FIELDS,
      orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
    });
    return members.map(toMemberSummary);
  }

  async addMember(
    projectId: string,
    input: AddProjectMemberInput,
    actorId: string,
  ): Promise<ProjectMemberSummary> {
    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
      select: { id: true, isActive: true },
    });
    if (!user)
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: "Cet utilisateur n'existe pas",
      });
    if (!user.isActive) {
      throw new BadRequestException({
        code: 'USER_INACTIVE',
        message: 'Un compte désactivé ne peut pas être affecté à un projet',
      });
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) {
      throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: 'Ce projet n’existe pas' });
    }

    const member = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: input.userId,
        role: input.role,
        capacity: input.capacity ?? null,
      },
      select: MEMBER_FIELDS,
    });

    const title = `Ajouté au projet ${project.name}`;
    const body = `Vous avez été ajouté au projet ${project.name} en tant que ${member.role}.`;

    await this.prisma.notification.create({
      data: {
        userId: member.user.id,
        projectId,
        type: NotificationType.PROJECT_MEMBER_ADDED,
        title,
        body,
        entityType: EntityType.PROJECT,
        entityId: projectId,
      },
    });

    await this.email.sendNotification(member.user.email, title, body);
    await this.audit(actorId, projectId, projectId, 'member_added', {
      userId: input.userId,
      role: member.role,
    });

    return toMemberSummary(member);
  }

  async updateMember(
    projectId: string,
    userId: string,
    input: UpdateProjectMemberInput,
    actorId: string,
  ): Promise<ProjectMemberSummary> {
    await this.assertMemberExists(projectId, userId);
    if (input.role && input.role !== ProjectRole.PROJECT_LEAD) {
      await this.assertNotLastProjectLead(projectId, userId);
    }

    const member = await this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      },
      select: MEMBER_FIELDS,
    });
    if (input.role !== undefined) {
      await this.audit(actorId, projectId, projectId, 'member_role_changed', {
        userId,
        role: input.role,
      });
    }
    return toMemberSummary(member);
  }

  /** Le retrait prend effet à la requête suivante : les droits sont relus en base. */
  async removeMember(projectId: string, userId: string, actorId: string): Promise<void> {
    await this.assertMemberExists(projectId, userId);
    await this.assertNotLastProjectLead(projectId, userId);

    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
    await this.audit(actorId, projectId, projectId, 'member_removed', { userId });
  }

  /** Trace des opérations d'administration sensibles, dans le journal d'activité existant. */
  private async audit(
    actorId: string,
    /** Projet de rattachement ; `null` une fois le projet supprimé. */
    projectId: string | null,
    entityId: string,
    action: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        projectId,
        entityType: EntityType.PROJECT,
        entityId,
        actorId,
        action,
        metadata,
      },
    });
  }

  private async assertMemberExists(projectId: string, userId: string): Promise<void> {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true },
    });
    if (!member) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: "Cet utilisateur n'est pas membre du projet",
      });
    }
  }

  /** Un projet doit conserver un responsable d'accès Project Lead. */
  private async assertNotLastProjectLead(projectId: string, userId: string): Promise<void> {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });
    if (member?.role !== ProjectRole.PROJECT_LEAD) return;

    const remaining = await this.prisma.projectMember.count({
      where: { projectId, role: ProjectRole.PROJECT_LEAD, userId: { not: userId } },
    });
    if (remaining === 0) {
      throw new BadRequestException({
        code: 'LAST_PROJECT_LEAD',
        message: 'Le projet doit conserver au moins un Project Lead',
      });
    }
  }
}

function projectNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'PROJECT_NOT_FOUND',
    message: "Ce projet n'existe pas",
  });
}

function toProjectSummary(
  project: ProjectRow,
  currentUserRole: ProjectRole | null,
): ProjectSummary {
  const activeSprint = project.sprints[0] ?? null;
  const persistedStatus = project.status as ProjectStatus;
  const effectiveStatus =
    persistedStatus === ProjectStatus.ACTIVE && !activeSprint
      ? ProjectStatus.ON_HOLD
      : persistedStatus;

  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    company: project.company,
    status: persistedStatus,
    effectiveStatus,
    activeSprint,
    startDate: project.startDate?.toISOString() ?? null,
    targetDate: project.targetDate?.toISOString() ?? null,
    color: project.color,
    memberCount: project._count.members,
    currentUserRole,
    createdAt: project.createdAt.toISOString(),
  };
}

function projectStatusFilter(status?: ProjectStatus): Prisma.ProjectWhereInput {
  if (status === ProjectStatus.ACTIVE) {
    return {
      status: ProjectStatus.ACTIVE,
      sprints: { some: { status: SprintStatus.ACTIVE } },
    };
  }
  if (status === ProjectStatus.ON_HOLD) {
    return {
      OR: [
        { status: ProjectStatus.ON_HOLD },
        {
          status: ProjectStatus.ACTIVE,
          sprints: { none: { status: SprintStatus.ACTIVE } },
        },
      ],
    };
  }
  return status ? { status } : {};
}

function toMemberSummary(member: MemberRow): ProjectMemberSummary {
  return {
    id: member.id,
    role: member.role as ProjectRole,
    capacity: member.capacity,
    joinedAt: member.joinedAt.toISOString(),
    user: member.user,
  };
}

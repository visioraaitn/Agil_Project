import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AddProjectMemberInput,
  AuthenticatedUser,
  CreateProjectInput,
  EntityType,
  isPlatformAdministrator,
  ListProjectsQuery,
  NotificationType,
  Paginated,
  ProjectMemberSummary,
  ProjectRole,
  ProjectStatus,
  ProjectSummary,
  UpdateProjectInput,
  UpdateProjectMemberInput,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectAccessService } from '../access/project-access.service';
import { EmailService } from '../collaboration/email.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly email: EmailService,
  ) {}

  /**
   * Un administrateur voit tous les projets ; les autres ne voient que ceux dont
   * ils sont membres — la liste ne doit pas révéler l'existence de projets
   * auxquels on n'a pas accès.
   */
  async list(
    user: AuthenticatedUser,
    query: ListProjectsQuery,
  ): Promise<Paginated<ProjectSummary>> {
    const isAdmin = isPlatformAdministrator(user.globalRole);
    const restrictToMemberships = !isAdmin || query.mine === true;

    const where: Prisma.ProjectWhereInput = {
      ...(restrictToMemberships ? { members: { some: { userId: user.id } } } : {}),
      ...(query.status ? { status: query.status } : {}),
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

  /**
   * Le créateur devient Product Owner du projet : sans membre porteur de ce
   * rôle, aucune PR ne pourrait être approuvée. Il reste retirable ensuite.
   */
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
          create: { userId: creatorId, role: ProjectRole.PRODUCT_OWNER },
        },
      },
      select: PROJECT_FIELDS,
    });

    return toProjectSummary(project, ProjectRole.PRODUCT_OWNER);
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

  /** Archivage plutôt que suppression : le projet porte tout l'historique agile. */
  async archive(projectId: string): Promise<void> {
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ARCHIVED, archivedAt: new Date() },
    });
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

  async addMember(projectId: string, input: AddProjectMemberInput): Promise<ProjectMemberSummary> {
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

    return toMemberSummary(member);
  }

  async updateMember(
    projectId: string,
    userId: string,
    input: UpdateProjectMemberInput,
  ): Promise<ProjectMemberSummary> {
    await this.assertMemberExists(projectId, userId);
    if (input.role && input.role !== ProjectRole.PRODUCT_OWNER) {
      await this.assertNotLastProductOwner(projectId, userId);
    }

    const member = await this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      },
      select: MEMBER_FIELDS,
    });
    return toMemberSummary(member);
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.assertMemberExists(projectId, userId);
    await this.assertNotLastProductOwner(projectId, userId);

    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
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

  /**
   * Un projet sans Product Owner bloquerait l'approbation des PR (E.1), seule
   * permission qu'aucun autre rôle ne détient.
   */
  private async assertNotLastProductOwner(projectId: string, userId: string): Promise<void> {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });
    if (member?.role !== ProjectRole.PRODUCT_OWNER) return;

    const remaining = await this.prisma.projectMember.count({
      where: { projectId, role: ProjectRole.PRODUCT_OWNER, userId: { not: userId } },
    });
    if (remaining === 0) {
      throw new BadRequestException({
        code: 'LAST_PRODUCT_OWNER',
        message: 'Le projet doit conserver au moins un Product Owner',
      });
    }
  }
}

function toProjectSummary(
  project: ProjectRow,
  currentUserRole: ProjectRole | null,
): ProjectSummary {
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    company: project.company,
    status: project.status as ProjectStatus,
    startDate: project.startDate?.toISOString() ?? null,
    targetDate: project.targetDate?.toISOString() ?? null,
    color: project.color,
    memberCount: project._count.members,
    currentUserRole,
    createdAt: project.createdAt.toISOString(),
  };
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

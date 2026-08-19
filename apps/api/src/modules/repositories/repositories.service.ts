import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PullRequestStatus,
  type BranchSummary,
  type CreateBranchInput,
  type CreateRepositoryInput,
  type RepositorySummary,
  type UpdateRepositoryInput,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BRANCH_SELECT,
  REPOSITORY_SELECT,
  toBranchSummary,
  toRepositorySummary,
} from './repository.mapper';

@Injectable()
export class RepositoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string): Promise<RepositorySummary[]> {
    const rows = await this.prisma.repository.findMany({
      where: { projectId },
      select: REPOSITORY_SELECT,
      orderBy: [{ isArchived: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toRepositorySummary);
  }

  async create(projectId: string, input: CreateRepositoryInput): Promise<RepositorySummary> {
    const existing = await this.prisma.repository.findFirst({
      where: { projectId, name: input.name },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'REPOSITORY_ALREADY_EXISTS',
        message: 'Un dépôt portant ce nom existe déjà dans ce projet',
      });
    }

    const created = await this.prisma.repository.create({
      data: {
        projectId,
        name: input.name,
        description: input.description ?? null,
        provider: input.provider,
        url: input.url,
        defaultBranch: input.defaultBranch,
        branches: {
          create: {
            name: input.defaultBranch,
            isLocalOnly: false,
            isProtected: true, // La branche par défaut est protégée par défaut
          },
        },
      },
      select: REPOSITORY_SELECT,
    });
    return toRepositorySummary(created);
  }

  async update(
    projectId: string,
    repositoryId: string,
    input: UpdateRepositoryInput,
  ): Promise<RepositorySummary> {
    await this.assertRepository(projectId, repositoryId);
    const row = await this.prisma.repository.update({
      where: { id: repositoryId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.provider !== undefined ? { provider: input.provider } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.defaultBranch !== undefined ? { defaultBranch: input.defaultBranch } : {}),
        ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
      },
      select: REPOSITORY_SELECT,
    });
    return toRepositorySummary(row);
  }

  async delete(projectId: string, repositoryId: string): Promise<void> {
    await this.assertRepository(projectId, repositoryId);
    await this.prisma.repository.delete({
      where: { id: repositoryId },
    });
  }

  async listBranches(projectId: string, repositoryId: string): Promise<BranchSummary[]> {
    await this.assertRepository(projectId, repositoryId);
    const rows = await this.prisma.branch.findMany({
      where: { repositoryId },
      select: BRANCH_SELECT,
      orderBy: [{ isProtected: 'desc' }, { isLocalOnly: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toBranchSummary);
  }

  async createBranch(
    projectId: string,
    repositoryId: string,
    input: CreateBranchInput,
    userId: string,
  ): Promise<BranchSummary> {
    await this.assertRepository(projectId, repositoryId);

    const existing = await this.prisma.branch.findFirst({
      where: { repositoryId, name: input.name },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'BRANCH_ALREADY_EXISTS',
        message: 'Une branche portant ce nom existe déjà dans ce dépôt',
      });
    }

    const row = await this.prisma.branch.create({
      data: {
        repositoryId,
        name: input.name,
        isLocalOnly: input.isLocalOnly,
        isProtected: input.isProtected ?? false,
        createdById: userId,
      },
      select: BRANCH_SELECT,
    });
    return toBranchSummary(row);
  }

  async deleteBranch(
    projectId: string,
    repositoryId: string,
    branchId: string,
    userId: string,
    globalRole: string,
  ): Promise<void> {
    await this.assertRepository(projectId, repositoryId);

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });

    const isPoOrAdmin =
      globalRole === 'ADMIN' || member?.role === 'PRODUCT_OWNER';

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, repositoryId },
      select: {
        id: true,
        name: true,
        isProtected: true,
        createdById: true,
        repository: { select: { defaultBranch: true } },
      },
    });

    if (!branch) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: "Cette branche n'existe pas",
      });
    }

    // Règle 1 : La branche par défaut ne peut jamais être supprimée
    if (branch.name === branch.repository.defaultBranch) {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_DEFAULT_BRANCH',
        message: 'Impossible de supprimer la branche par défaut du dépôt',
      });
    }

    // Règle 2 : Une branche protégée ne peut être supprimée que par un PO ou Admin
    if (branch.isProtected && !isPoOrAdmin) {
      throw new ForbiddenException({
        code: 'CANNOT_DELETE_PROTECTED_BRANCH',
        message: 'Seul un administrateur ou Product Owner peut supprimer une branche protégée',
      });
    }

    // Règle 3 : Un développeur ne peut supprimer que ses propres branches si non PO/Admin
    if (!isPoOrAdmin && branch.createdById && branch.createdById !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_BRANCH_DELETION',
        message: 'Vous ne pouvez supprimer que vos propres branches',
      });
    }

    // Règle 4 : Vérifier qu'aucune PR active n'utilise cette branche comme source ou cible
    const activePr = await this.prisma.pullRequest.findFirst({
      where: {
        repositoryId,
        OR: [{ sourceBranchId: branchId }, { targetBranchId: branchId }],
        status: {
          in: [
            PullRequestStatus.OPEN,
            PullRequestStatus.READY_FOR_APPROVAL,
            PullRequestStatus.APPROVED,
            PullRequestStatus.CHANGES_REQUESTED,
          ],
        },
      },
      select: { id: true, number: true },
    });

    if (activePr) {
      throw new BadRequestException({
        code: 'BRANCH_IN_USE_BY_ACTIVE_PR',
        message: `Impossible de supprimer cette branche : elle est utilisée par la PR active #${activePr.number}`,
      });
    }

    await this.prisma.branch.delete({
      where: { id: branchId },
    });
  }

  async assertRepository(projectId: string, repositoryId: string): Promise<void> {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, projectId },
      select: { id: true },
    });
    if (!repository) {
      throw new NotFoundException({
        code: 'REPOSITORY_NOT_FOUND',
        message: "Ce dépôt n'existe pas dans ce projet",
      });
    }
  }

  async assertBranch(repositoryId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, repositoryId },
      select: { id: true },
    });
    if (!branch) {
      throw new BadRequestException({
        code: 'BRANCH_NOT_FOUND',
        message: "Cette branche n'appartient pas au dépôt",
      });
    }
  }
}

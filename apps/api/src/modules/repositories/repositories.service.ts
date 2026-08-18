import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BranchSummary,
  CreateBranchInput,
  CreateRepositoryInput,
  RepositorySummary,
  UpdateRepositoryInput,
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
      orderBy: { name: 'asc' },
    });
    return rows.map(toRepositorySummary);
  }

  async create(projectId: string, input: CreateRepositoryInput): Promise<RepositorySummary> {
    const created = await this.prisma.repository.create({
      data: {
        projectId,
        name: input.name,
        provider: input.provider,
        url: input.url,
        defaultBranch: input.defaultBranch,
        branches: { create: { name: input.defaultBranch, isLocalOnly: false } },
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
      data: pick(input, ['name', 'provider', 'url', 'defaultBranch']),
      select: REPOSITORY_SELECT,
    });
    return toRepositorySummary(row);
  }

  async listBranches(projectId: string, repositoryId: string): Promise<BranchSummary[]> {
    await this.assertRepository(projectId, repositoryId);
    const rows = await this.prisma.branch.findMany({
      where: { repositoryId },
      select: BRANCH_SELECT,
      orderBy: [{ isLocalOnly: 'asc' }, { name: 'asc' }],
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
    const row = await this.prisma.branch.create({
      data: {
        repositoryId,
        name: input.name,
        isLocalOnly: input.isLocalOnly,
        createdById: userId,
      },
      select: BRANCH_SELECT,
    });
    return toBranchSummary(row);
  }

  async assertRepository(projectId: string, repositoryId: string): Promise<void> {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, projectId },
      select: { id: true },
    });
    if (!repository) {
      throw new NotFoundException({
        code: 'REPOSITORY_NOT_FOUND',
        message: "Ce depot n'existe pas dans ce projet",
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
        message: "Cette branche n'appartient pas au depot",
      });
    }
  }
}

function pick<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

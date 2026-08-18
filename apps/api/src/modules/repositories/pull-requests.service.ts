import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreatePullRequestInput,
  PullRequestDetail,
  PullRequestStatus,
  PullRequestSummary,
  UpdatePullRequestStatusInput,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PULL_REQUEST_DETAIL_SELECT,
  PULL_REQUEST_SELECT,
  toPullRequestDetail,
  toPullRequestSummary,
} from './repository.mapper';
import { RepositoriesService } from './repositories.service';

@Injectable()
export class PullRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repositories: RepositoriesService,
  ) {}

  async list(projectId: string): Promise<PullRequestSummary[]> {
    const rows = await this.prisma.pullRequest.findMany({
      where: { workItem: { projectId, deletedAt: null } },
      select: PULL_REQUEST_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPullRequestSummary);
  }

  async getById(projectId: string, pullRequestId: string): Promise<PullRequestDetail> {
    const row = await this.prisma.pullRequest.findFirst({
      where: { id: pullRequestId, workItem: { projectId, deletedAt: null } },
      select: PULL_REQUEST_DETAIL_SELECT,
    });
    if (!row) throw this.notFound();
    return toPullRequestDetail(row);
  }

  async create(
    projectId: string,
    input: CreatePullRequestInput,
    userId: string,
  ): Promise<PullRequestDetail> {
    await this.assertWorkItem(projectId, input.workItemId);
    await this.repositories.assertRepository(projectId, input.repositoryId);
    await this.repositories.assertBranch(input.repositoryId, input.sourceBranchId);
    if (input.targetBranchId) await this.repositories.assertBranch(input.repositoryId, input.targetBranchId);

    const created = await this.prisma.$transaction(async (tx) => {
      const pr = await tx.pullRequest.create({
        data: {
          workItemId: input.workItemId,
          repositoryId: input.repositoryId,
          title: input.title,
          externalNumber: input.externalNumber ?? null,
          externalUrl: input.externalUrl ?? null,
          sourceBranchId: input.sourceBranchId,
          targetBranchId: input.targetBranchId ?? null,
          targetBranchName: input.targetBranchName ?? null,
          declaredById: userId,
          events: {
            create: {
              actorId: userId,
              toStatus: PullRequestStatus.OPEN,
              comment: 'PR declaree',
            },
          },
        },
        select: { id: true },
      });
      return pr;
    });

    return this.getById(projectId, created.id);
  }

  async updateStatus(
    projectId: string,
    pullRequestId: string,
    input: UpdatePullRequestStatusInput,
    userId: string,
  ): Promise<PullRequestDetail> {
    const current = await this.prisma.pullRequest.findFirst({
      where: { id: pullRequestId, workItem: { projectId, deletedAt: null } },
      select: { id: true, status: true },
    });
    if (!current) throw this.notFound();

    this.assertTransition(current.status as PullRequestStatus, input.status);

    await this.prisma.$transaction(async (tx) => {
      await tx.pullRequest.update({
        where: { id: pullRequestId },
        data: {
          status: input.status,
          ...(input.status === PullRequestStatus.APPROVED ||
          input.status === PullRequestStatus.CHANGES_REQUESTED
            ? {
                reviewedById: userId,
                reviewedAt: new Date(),
                reviewComment: input.comment ?? null,
              }
            : {}),
        },
      });
      await tx.pullRequestEvent.create({
        data: {
          pullRequestId,
          actorId: userId,
          fromStatus: current.status,
          toStatus: input.status,
          comment: input.comment ?? null,
        },
      });
    });

    return this.getById(projectId, pullRequestId);
  }

  private async assertWorkItem(projectId: string, workItemId: string): Promise<void> {
    const workItem = await this.prisma.workItem.findFirst({
      where: { id: workItemId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!workItem) {
      throw new BadRequestException({
        code: 'WORK_ITEM_NOT_FOUND',
        message: "Ce ticket n'existe pas dans le projet",
      });
    }
  }

  private assertTransition(from: PullRequestStatus, to: PullRequestStatus): void {
    const allowed: Record<PullRequestStatus, readonly PullRequestStatus[]> = {
      [PullRequestStatus.OPEN]: [
        PullRequestStatus.READY_FOR_APPROVAL,
        PullRequestStatus.CLOSED,
      ],
      [PullRequestStatus.READY_FOR_APPROVAL]: [
        PullRequestStatus.APPROVED,
        PullRequestStatus.CHANGES_REQUESTED,
        PullRequestStatus.CLOSED,
      ],
      [PullRequestStatus.CHANGES_REQUESTED]: [
        PullRequestStatus.READY_FOR_APPROVAL,
        PullRequestStatus.CLOSED,
      ],
      [PullRequestStatus.APPROVED]: [PullRequestStatus.MERGED, PullRequestStatus.CLOSED],
      [PullRequestStatus.MERGED]: [],
      [PullRequestStatus.CLOSED]: [],
    };
    if (!allowed[from].includes(to)) {
      throw new BadRequestException({
        code: 'INVALID_PR_TRANSITION',
        message: `Transition PR impossible : ${from} vers ${to}`,
      });
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: 'PULL_REQUEST_NOT_FOUND', message: "Cette PR n'existe pas" });
  }
}

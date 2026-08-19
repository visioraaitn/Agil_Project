import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreatePullRequestCommentInput,
  CreatePullRequestInput,
  NotificationType,
  ProjectRole,
  PullRequestCommentSummary,
  PullRequestDetail,
  PullRequestStatus,
  PullRequestSummary,
  UpdatePullRequestStatusInput,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../collaboration/notifications.service';
import { RepositoriesService } from './repositories.service';
import {
  PULL_REQUEST_DETAIL_SELECT,
  PULL_REQUEST_SELECT,
  toPullRequestDetail,
  toPullRequestSummary,
} from './repository.mapper';

@Injectable()
export class PullRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repositories: RepositoriesService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    projectId: string,
    filter?: { repositoryId?: string; status?: PullRequestStatus },
  ): Promise<PullRequestSummary[]> {
    const rows = await this.prisma.pullRequest.findMany({
      where: {
        workItem: { projectId, deletedAt: null },
        ...(filter?.repositoryId ? { repositoryId: filter.repositoryId } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
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

    if (input.targetBranchId) {
      await this.repositories.assertBranch(input.repositoryId, input.targetBranchId);

      // Règle 1 : La branche source et la branche cible doivent être distinctes
      if (input.sourceBranchId === input.targetBranchId) {
        throw new BadRequestException({
          code: 'SAME_SOURCE_AND_TARGET_BRANCH',
          message: 'La branche source et la branche cible doivent être différentes',
        });
      }

      // Règle 2 : Empêcher les doublons de PR actives pour la même paire source/cible
      const duplicatePr = await this.prisma.pullRequest.findFirst({
        where: {
          repositoryId: input.repositoryId,
          sourceBranchId: input.sourceBranchId,
          targetBranchId: input.targetBranchId,
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

      if (duplicatePr) {
        throw new BadRequestException({
          code: 'DUPLICATE_ACTIVE_PR',
          message: `Une Pull Request active (#${duplicatePr.number}) existe déjà entre ces branches`,
        });
      }
    }

    const createdId = await this.prisma.$transaction(async (tx) => {
      // Compteur séquentiel garanti par verrouillage optimiste / incrémentation atomique
      const repo = await tx.repository.update({
        where: { id: input.repositoryId },
        data: { lastPrNumber: { increment: 1 } },
        select: { lastPrNumber: true, name: true, project: { select: { key: true, name: true } } },
      });

      const pr = await tx.pullRequest.create({
        data: {
          number: repo.lastPrNumber,
          workItemId: input.workItemId,
          repositoryId: input.repositoryId,
          title: input.title,
          description: input.description ?? null,
          externalNumber: input.externalNumber ?? null,
          externalUrl: input.externalUrl ?? null,
          status: PullRequestStatus.OPEN,
          sourceBranchId: input.sourceBranchId,
          targetBranchId: input.targetBranchId ?? null,
          targetBranchName: input.targetBranchName ?? null,
          declaredById: userId,
          events: {
            create: {
              actorId: userId,
              fromStatus: null,
              toStatus: PullRequestStatus.OPEN,
              comment: 'Pull Request créée',
            },
          },
        },
        select: { id: true, number: true, title: true },
      });

      return pr.id;
    });

    const result = await this.getById(projectId, createdId);

    // Notifications en arrière-plan aux Product Owners et Administrateurs du projet
    void this.notifyAdminsOnCreation(projectId, result, userId);

    return result;
  }

  async updateStatus(
    projectId: string,
    pullRequestId: string,
    input: UpdatePullRequestStatusInput,
    userId: string,
  ): Promise<PullRequestDetail> {
    const current = await this.prisma.pullRequest.findFirst({
      where: { id: pullRequestId, workItem: { projectId, deletedAt: null } },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        declaredById: true,
        repositoryId: true,
        targetBranch: { select: { isProtected: true, name: true } },
      },
    });
    if (!current) throw this.notFound();

    this.assertTransition(current.status as PullRequestStatus, input.status);

    // Règle de sécurité : Interdiction d'auto-approbation sur branche protégée
    if (input.status === PullRequestStatus.APPROVED) {
      if (current.declaredById === userId && current.targetBranch?.isProtected) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_SELF_APPROVAL',
          message:
            'Auto-approbation interdite : vous ne pouvez pas approuver votre propre Pull Request vers une branche protégée',
        });
      }
    }

    // Règle de validation : Le rejet nécessite un motif textuel non vide
    if (input.status === PullRequestStatus.REJECTED) {
      const reason = input.rejectionReason ?? input.comment;
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException({
          code: 'REJECTION_REASON_REQUIRED',
          message: 'Un motif d’explication est obligatoire pour rejeter une Pull Request',
        });
      }
    }

    // Règle de validation : La demande de modification nécessite un motif
    if (input.status === PullRequestStatus.CHANGES_REQUESTED) {
      if (!input.comment || input.comment.trim().length === 0) {
        throw new BadRequestException({
          code: 'CHANGES_REASON_REQUIRED',
          message: 'Veuillez préciser les modifications attendues dans le commentaire',
        });
      }
    }

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
          ...(input.status === PullRequestStatus.REJECTED
            ? {
                reviewedById: userId,
                reviewedAt: new Date(),
                rejectionReason: input.rejectionReason ?? input.comment ?? null,
              }
            : {}),
          ...(input.status === PullRequestStatus.MERGED
            ? {
                mergedById: userId,
                mergedAt: new Date(),
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
          comment: input.rejectionReason ?? input.comment ?? null,
        },
      });
    });

    const updated = await this.getById(projectId, pullRequestId);

    // Notifications en arrière-plan à l'auteur de la PR
    void this.notifyAuthorOnStatusChange(projectId, updated, current.status as PullRequestStatus, userId);

    return updated;
  }

  async addComment(
    projectId: string,
    pullRequestId: string,
    input: CreatePullRequestCommentInput,
    userId: string,
  ): Promise<PullRequestCommentSummary> {
    const pr = await this.prisma.pullRequest.findFirst({
      where: { id: pullRequestId, workItem: { projectId, deletedAt: null } },
      select: { id: true, number: true, title: true, declaredById: true },
    });
    if (!pr) throw this.notFound();

    const created = await this.prisma.pullRequestComment.create({
      data: {
        pullRequestId,
        authorId: userId,
        body: input.body,
      },
      select: {
        id: true,
        pullRequestId: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    // Notifier l'auteur si le commentaire vient d'un tiers
    if (pr.declaredById !== userId) {
      void this.notifications.notifyPullRequestEvent({
        userIds: [pr.declaredById],
        projectId,
        pullRequestId,
        type: NotificationType.PR_COMMENTED,
        title: `Nouveau commentaire sur la PR #${pr.number}`,
        body: `${created.author.name} a commenté : ${input.body.slice(0, 150)}`,
      });
    }

    return {
      id: created.id,
      pullRequestId: created.pullRequestId,
      author: created.author,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  private async assertWorkItem(projectId: string, workItemId: string) {
    const workItem = await this.prisma.workItem.findFirst({
      where: { id: workItemId, projectId, deletedAt: null },
      select: { id: true, number: true, title: true },
    });
    if (!workItem) {
      throw new BadRequestException({
        code: 'WORK_ITEM_NOT_FOUND',
        message: "Ce ticket n'existe pas dans le projet",
      });
    }
    return workItem;
  }

  private assertTransition(from: PullRequestStatus, to: PullRequestStatus): void {
    const allowed: Record<PullRequestStatus, readonly PullRequestStatus[]> = {
      [PullRequestStatus.OPEN]: [
        PullRequestStatus.READY_FOR_APPROVAL,
        PullRequestStatus.APPROVED,
        PullRequestStatus.CHANGES_REQUESTED,
        PullRequestStatus.REJECTED,
        PullRequestStatus.CLOSED,
      ],
      [PullRequestStatus.READY_FOR_APPROVAL]: [
        PullRequestStatus.APPROVED,
        PullRequestStatus.CHANGES_REQUESTED,
        PullRequestStatus.REJECTED,
        PullRequestStatus.CLOSED,
      ],
      [PullRequestStatus.CHANGES_REQUESTED]: [
        PullRequestStatus.READY_FOR_APPROVAL,
        PullRequestStatus.REJECTED,
        PullRequestStatus.CLOSED,
      ],
      [PullRequestStatus.APPROVED]: [
        PullRequestStatus.MERGED,
        PullRequestStatus.CHANGES_REQUESTED,
        PullRequestStatus.CLOSED,
      ],
      [PullRequestStatus.REJECTED]: [
        PullRequestStatus.CLOSED,
      ],
      [PullRequestStatus.MERGED]: [],
      [PullRequestStatus.CLOSED]: [],
    };

    if (!allowed[from]?.includes(to)) {
      throw new BadRequestException({
        code: 'INVALID_PR_TRANSITION',
        message: `Transition PR non autorisée : ${from} vers ${to}`,
      });
    }
  }

  private async notifyAdminsOnCreation(
    projectId: string,
    pr: PullRequestDetail,
    actorId: string,
  ): Promise<void> {
    try {
      const admins = await this.prisma.projectMember.findMany({
        where: {
          projectId,
          role: { in: [ProjectRole.PRODUCT_OWNER, ProjectRole.SCRUM_MASTER] },
          userId: { not: actorId },
        },
        select: { userId: true },
      });

      const adminUserIds = admins.map((a) => a.userId);
      if (adminUserIds.length > 0) {
        await this.notifications.notifyPullRequestEvent({
          userIds: adminUserIds,
          projectId,
          pullRequestId: pr.id,
          type: NotificationType.PR_CREATED,
          title: `Nouvelle PR #${pr.number} : ${pr.title}`,
          body: `${pr.declaredBy.name} a ouvert une PR dans ${pr.repository.name} (${pr.sourceBranch.name} → ${pr.targetBranch?.name ?? 'cible'})`,
        });
      }
    } catch {
      // Les notifications asynchrones ne bloquent pas le retour HTTP
    }
  }

  private async notifyAuthorOnStatusChange(
    projectId: string,
    pr: PullRequestDetail,
    fromStatus: PullRequestStatus,
    actorId: string,
  ): Promise<void> {
    try {
      if (pr.declaredBy.id === actorId) return;

      let type: NotificationType = NotificationType.PR_APPROVED;
      let title = `PR #${pr.number} mise à jour`;
      let body = `Le statut de votre PR est maintenant : ${pr.status}`;

      if (pr.status === PullRequestStatus.APPROVED) {
        type = NotificationType.PR_APPROVED;
        title = `PR #${pr.number} Approuvée ✅`;
        body = `${pr.reviewedBy?.name ?? 'Le reviewer'} a approuvé votre Pull Request.`;
      } else if (pr.status === PullRequestStatus.CHANGES_REQUESTED) {
        type = NotificationType.PR_CHANGES_REQUESTED;
        title = `Modifications demandées sur la PR #${pr.number} ⚠️`;
        body = `${pr.reviewedBy?.name ?? 'Le reviewer'} : ${pr.reviewComment ?? 'Veuillez réviser votre code.'}`;
      } else if (pr.status === PullRequestStatus.REJECTED) {
        type = NotificationType.PR_REJECTED;
        title = `PR #${pr.number} Rejetée ❌`;
        body = `Motif du rejet : ${pr.rejectionReason ?? 'Non conforme.'}`;
      } else if (pr.status === PullRequestStatus.MERGED) {
        type = NotificationType.PR_MERGED;
        title = `PR #${pr.number} Fusionnée 🚀`;
        body = `${pr.mergedBy?.name ?? 'L’administrateur'} a fusionné votre code avec succès.`;
      } else if (pr.status === PullRequestStatus.CLOSED) {
        type = NotificationType.PR_CLOSED;
        title = `PR #${pr.number} Fermée`;
        body = `La Pull Request a été clôturée sans fusion.`;
      }

      await this.notifications.notifyPullRequestEvent({
        userIds: [pr.declaredBy.id],
        projectId,
        pullRequestId: pr.id,
        type,
        title,
        body,
      });
    } catch {
      // Les notifications asynchrones ne bloquent pas le retour HTTP
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'PULL_REQUEST_NOT_FOUND',
      message: "Cette Pull Request n'existe pas",
    });
  }
}

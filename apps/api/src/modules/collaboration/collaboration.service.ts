import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivitySummary,
  CommentSummary,
  CreateCommentInput,
  EntityType,
  NotificationSummary,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ACTIVITY_SELECT,
  COMMENT_SELECT,
  NOTIFICATION_SELECT,
  toActivitySummary,
  toCommentSummary,
  toNotificationSummary,
} from './collaboration.mapper';
import { NotificationsService } from './notifications.service';

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listComments(projectId: string, itemId: string): Promise<CommentSummary[]> {
    await this.assertWorkItem(projectId, itemId);
    const rows = await this.prisma.comment.findMany({
      where: { workItemId: itemId, deletedAt: null },
      select: COMMENT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toCommentSummary);
  }

  async createComment(
    projectId: string,
    itemId: string,
    input: CreateCommentInput,
    authorId: string,
  ): Promise<CommentSummary> {
    const item = await this.assertWorkItem(projectId, itemId);
    await this.assertMentions(projectId, input.mentionedUserIds ?? []);

    const notified = new Set((input.mentionedUserIds ?? []).filter((id) => id !== authorId));

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          workItemId: itemId,
          authorId,
          body: input.body,
          parentId: input.parentId ?? null,
          mentionedUserIds: input.mentionedUserIds ?? [],
        },
        select: COMMENT_SELECT,
      });

      await tx.activityLog.create({
        data: {
          projectId,
          entityType: EntityType.WORK_ITEM,
          entityId: itemId,
          actorId: authorId,
          action: 'commented',
          field: 'comment',
          newValue: created.id,
        },
      });

      return created;
    });

    await this.notifications.notifyMention({
      userIds: [...notified],
      projectId,
      itemId,
      itemKey: item.key,
      body: input.body,
    });

    return toCommentSummary(comment);
  }

  async deleteComment(projectId: string, itemId: string, commentId: string): Promise<void> {
    await this.assertWorkItem(projectId, itemId);
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, workItemId: itemId, deletedAt: null },
      select: { id: true },
    });
    if (!comment) throw new NotFoundException({ code: 'COMMENT_NOT_FOUND', message: "Ce commentaire n'existe pas" });
    await this.prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  }

  async listActivity(projectId: string, itemId: string): Promise<ActivitySummary[]> {
    await this.assertWorkItem(projectId, itemId);
    const rows = await this.prisma.activityLog.findMany({
      where: { projectId, entityId: itemId },
      select: ACTIVITY_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map(toActivitySummary);
  }

  async listNotifications(userId: string): Promise<NotificationSummary[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      select: NOTIFICATION_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map(toNotificationSummary);
  }

  async markNotificationRead(userId: string, notificationId: string): Promise<NotificationSummary> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND', message: "Cette notification n'existe pas" });
    const row = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
      select: NOTIFICATION_SELECT,
    });
    return toNotificationSummary(row);
  }

  private async assertWorkItem(projectId: string, itemId: string): Promise<{ key: string }> {
    const item = await this.prisma.workItem.findFirst({
      where: { id: itemId, projectId, deletedAt: null },
      select: { number: true, project: { select: { key: true } } },
    });
    if (!item) throw new NotFoundException({ code: 'WORK_ITEM_NOT_FOUND', message: "Ce ticket n'existe pas" });
    return { key: `${item.project.key}-${item.number}` };
  }

  private async assertMentions(projectId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const count = await this.prisma.projectMember.count({
      where: { projectId, userId: { in: [...new Set(userIds)] } },
    });
    if (count !== new Set(userIds).size) {
      throw new BadRequestException({
        code: 'MENTION_NOT_PROJECT_MEMBER',
        message: 'Une personne mentionnee n appartient pas au projet',
      });
    }
  }
}

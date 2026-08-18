import { Prisma } from '@prisma/client';
import type {
  ActivitySummary,
  CommentSummary,
  EntityType,
  NotificationSummary,
  NotificationType,
} from '@visiora/shared';

export const COMMENT_SELECT = {
  id: true,
  workItemId: true,
  body: true,
  parentId: true,
  mentionedUserIds: true,
  createdAt: true,
  updatedAt: true,
  editedAt: true,
  author: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.CommentSelect;

export type CommentRow = Prisma.CommentGetPayload<{ select: typeof COMMENT_SELECT }>;

export const ACTIVITY_SELECT = {
  id: true,
  projectId: true,
  entityType: true,
  entityId: true,
  action: true,
  field: true,
  oldValue: true,
  newValue: true,
  createdAt: true,
  actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.ActivityLogSelect;

export type ActivityRow = Prisma.ActivityLogGetPayload<{ select: typeof ACTIVITY_SELECT }>;

export const NOTIFICATION_SELECT = {
  id: true,
  projectId: true,
  type: true,
  title: true,
  body: true,
  entityType: true,
  entityId: true,
  isRead: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof NOTIFICATION_SELECT }>;

export function toCommentSummary(row: CommentRow): CommentSummary {
  return {
    id: row.id,
    workItemId: row.workItemId,
    body: row.body,
    parentId: row.parentId,
    mentionedUserIds: row.mentionedUserIds,
    author: row.author,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
  };
}

export function toActivitySummary(row: ActivityRow): ActivitySummary {
  return {
    id: row.id,
    projectId: row.projectId,
    entityType: row.entityType as EntityType,
    entityId: row.entityId,
    action: row.action,
    field: row.field,
    oldValue: row.oldValue,
    newValue: row.newValue,
    actor: row.actor,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toNotificationSummary(row: NotificationRow): NotificationSummary {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    entityType: row.entityType as EntityType | null,
    entityId: row.entityId,
    isRead: row.isRead,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

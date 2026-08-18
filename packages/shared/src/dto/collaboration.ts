import { z } from 'zod';
import { uuidSchema } from './common';
import type { EntityType, NotificationType } from '../enums';
import type { UserDirectoryEntry } from './user';

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Le commentaire ne peut pas etre vide').max(5000),
  parentId: uuidSchema.nullable().optional(),
  mentionedUserIds: z.array(uuidSchema).max(20).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export interface CommentSummary {
  id: string;
  workItemId: string;
  body: string;
  parentId: string | null;
  mentionedUserIds: string[];
  author: UserDirectoryEntry;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
}

export interface ActivitySummary {
  id: string;
  projectId: string | null;
  entityType: EntityType;
  entityId: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: UserDirectoryEntry | null;
  createdAt: string;
}

export interface NotificationSummary {
  id: string;
  projectId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: EntityType | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

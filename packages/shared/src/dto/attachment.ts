import { z } from 'zod';
import type { UserDirectoryEntry } from './user';

export const MAX_ATTACHMENT_SIZE_MB = 25;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const attachmentUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_ATTACHMENT_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_SIZE_MB * 1024 * 1024),
});
export type AttachmentUploadInput = z.infer<typeof attachmentUploadSchema>;

export interface AttachmentSummary {
  id: string;
  workItemId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: UserDirectoryEntry;
  createdAt: string;
}

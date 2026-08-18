import type { AttachmentSummary } from '@visiora/shared';
import { Prisma } from '@prisma/client';

export const ATTACHMENT_SELECT = {
  id: true,
  workItemId: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.AttachmentSelect;

export type AttachmentRow = Prisma.AttachmentGetPayload<{ select: typeof ATTACHMENT_SELECT }>;

export function toAttachmentSummary(row: AttachmentRow): AttachmentSummary {
  return {
    id: row.id,
    workItemId: row.workItemId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

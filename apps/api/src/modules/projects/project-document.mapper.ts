import { Prisma } from '@prisma/client';
import { PROJECT_DOCUMENT_MIME_TYPE, type ProjectDocumentSummary } from '@visiora/shared';

export const PROJECT_DOCUMENT_SELECT = {
  id: true,
  projectId: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.ProjectDocumentSelect;

export type ProjectDocumentRow = Prisma.ProjectDocumentGetPayload<{
  select: typeof PROJECT_DOCUMENT_SELECT;
}>;

export function toProjectDocumentSummary(row: ProjectDocumentRow): ProjectDocumentSummary {
  return {
    id: row.id,
    projectId: row.projectId,
    fileName: row.fileName,
    mimeType: PROJECT_DOCUMENT_MIME_TYPE,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

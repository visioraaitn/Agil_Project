import type { UserDirectoryEntry } from './user';

export const PROJECT_DOCUMENT_MIME_TYPE = 'application/pdf';

export interface ProjectDocumentSummary {
  id: string;
  projectId: string;
  fileName: string;
  mimeType: typeof PROJECT_DOCUMENT_MIME_TYPE;
  sizeBytes: number;
  uploadedBy: UserDirectoryEntry;
  createdAt: string;
}

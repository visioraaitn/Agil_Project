import { z } from 'zod';
import { GitProvider, PullRequestStatus } from '../enums';
import { uuidSchema } from './common';
import type { UserDirectoryEntry } from './user';

export const createRepositorySchema = z.object({
  name: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caracteres').max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  provider: z.nativeEnum(GitProvider).default(GitProvider.GITHUB),
  url: z.string().trim().url('URL invalide').max(500),
  defaultBranch: z.string().trim().min(1).max(120).default('main'),
});
export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;

export const updateRepositorySchema = createRepositorySchema
  .partial()
  .extend({
    isArchived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ a mettre a jour' });
export type UpdateRepositoryInput = z.infer<typeof updateRepositorySchema>;

export const createBranchSchema = z.object({
  name: z.string().trim().min(1, 'Le nom de branche est obligatoire').max(180),
  isLocalOnly: z.boolean().default(true),
  isProtected: z.boolean().default(false),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const createPullRequestSchema = z.object({
  workItemId: uuidSchema,
  repositoryId: uuidSchema,
  title: z.string().trim().min(3, 'Le titre doit contenir au moins 3 caracteres').max(255),
  description: z.string().trim().max(10000).nullable().optional(),
  externalNumber: z.number().int().positive().nullable().optional(),
  externalUrl: z.string().trim().url('URL invalide').nullable().optional(),
  sourceBranchId: uuidSchema,
  targetBranchId: uuidSchema.nullable().optional(),
  targetBranchName: z.string().trim().max(180).nullable().optional(),
});
export type CreatePullRequestInput = z.infer<typeof createPullRequestSchema>;

export const updatePullRequestStatusSchema = z.object({
  status: z.nativeEnum(PullRequestStatus),
  comment: z.string().trim().max(2000).nullable().optional(),
  rejectionReason: z.string().trim().max(2000).nullable().optional(),
});
export type UpdatePullRequestStatusInput = z.infer<typeof updatePullRequestStatusSchema>;

export const createPullRequestCommentSchema = z.object({
  body: z.string().trim().min(1, 'Le commentaire ne peut pas etre vide').max(5000),
});
export type CreatePullRequestCommentInput = z.infer<typeof createPullRequestCommentSchema>;

export interface BranchSummary {
  id: string;
  repositoryId: string;
  name: string;
  isLocalOnly: boolean;
  isProtected: boolean;
  createdBy: UserDirectoryEntry | null;
  createdAt: string;
}

export interface RepositorySummary {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  provider: GitProvider;
  url: string;
  defaultBranch: string;
  isArchived: boolean;
  externalId: string | null;
  lastSyncedAt: string | null;
  branchCount: number;
  pullRequestCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestEventSummary {
  id: string;
  fromStatus: PullRequestStatus | null;
  toStatus: PullRequestStatus;
  comment: string | null;
  actor: UserDirectoryEntry | null;
  createdAt: string;
}

export interface PullRequestCommentSummary {
  id: string;
  pullRequestId: string;
  author: UserDirectoryEntry;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestSummary {
  id: string;
  number: number;
  workItem: { id: string; key: string; title: string };
  repository: { id: string; name: string; provider: GitProvider; url: string };
  title: string;
  description: string | null;
  externalNumber: number | null;
  externalUrl: string | null;
  status: PullRequestStatus;
  sourceBranch: BranchSummary;
  targetBranch: BranchSummary | null;
  targetBranchName: string | null;
  declaredBy: UserDirectoryEntry;
  reviewedBy: UserDirectoryEntry | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  rejectionReason: string | null;
  mergedBy: UserDirectoryEntry | null;
  mergedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestDetail extends PullRequestSummary {
  events: PullRequestEventSummary[];
  comments: PullRequestCommentSummary[];
}

import { z } from 'zod';
import { GitProvider, PullRequestStatus } from '../enums';
import { uuidSchema } from './common';
import type { UserDirectoryEntry } from './user';

export const createRepositorySchema = z.object({
  name: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caracteres').max(120),
  provider: z.nativeEnum(GitProvider).default(GitProvider.GITHUB),
  url: z.string().trim().url('URL invalide').max(500),
  defaultBranch: z.string().trim().min(1).max(120).default('main'),
});
export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;

export const updateRepositorySchema = createRepositorySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ a mettre a jour' });
export type UpdateRepositoryInput = z.infer<typeof updateRepositorySchema>;

export const createBranchSchema = z.object({
  name: z.string().trim().min(1, 'Le nom de branche est obligatoire').max(180),
  isLocalOnly: z.boolean().default(true),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const createPullRequestSchema = z.object({
  workItemId: uuidSchema,
  repositoryId: uuidSchema,
  title: z.string().trim().min(3, 'Le titre doit contenir au moins 3 caracteres').max(255),
  externalNumber: z.number().int().positive().nullable().optional(),
  externalUrl: z.string().trim().url('URL invalide').nullable().optional(),
  sourceBranchId: uuidSchema,
  targetBranchId: uuidSchema.nullable().optional(),
  targetBranchName: z.string().trim().max(180).nullable().optional(),
});
export type CreatePullRequestInput = z.infer<typeof createPullRequestSchema>;

export const updatePullRequestStatusSchema = z.object({
  status: z.enum([
    PullRequestStatus.READY_FOR_APPROVAL,
    PullRequestStatus.APPROVED,
    PullRequestStatus.CHANGES_REQUESTED,
    PullRequestStatus.MERGED,
    PullRequestStatus.CLOSED,
  ]),
  comment: z.string().trim().max(2000).nullable().optional(),
});
export type UpdatePullRequestStatusInput = z.infer<typeof updatePullRequestStatusSchema>;

export interface BranchSummary {
  id: string;
  repositoryId: string;
  name: string;
  isLocalOnly: boolean;
  createdBy: UserDirectoryEntry | null;
  createdAt: string;
}

export interface RepositorySummary {
  id: string;
  projectId: string;
  name: string;
  provider: GitProvider;
  url: string;
  defaultBranch: string;
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

export interface PullRequestSummary {
  id: string;
  workItem: { id: string; key: string; title: string };
  repository: { id: string; name: string; provider: GitProvider; url: string };
  title: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface PullRequestDetail extends PullRequestSummary {
  events: PullRequestEventSummary[];
}

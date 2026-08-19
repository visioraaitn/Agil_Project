import { Prisma } from '@prisma/client';
import type {
  BranchSummary,
  GitProvider,
  PullRequestCommentSummary,
  PullRequestDetail,
  PullRequestEventSummary,
  PullRequestStatus,
  PullRequestSummary,
  RepositorySummary,
} from '@visiora/shared';
import { workItemKey } from '../work-items/work-item.mapper';

export const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export const BRANCH_SELECT = {
  id: true,
  repositoryId: true,
  name: true,
  isLocalOnly: true,
  isProtected: true,
  createdAt: true,
  createdBy: { select: USER_SELECT },
} satisfies Prisma.BranchSelect;

export type BranchRow = Prisma.BranchGetPayload<{ select: typeof BRANCH_SELECT }>;

export const REPOSITORY_SELECT = {
  id: true,
  projectId: true,
  name: true,
  description: true,
  provider: true,
  url: true,
  defaultBranch: true,
  isArchived: true,
  externalId: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { branches: true, pullRequests: true } },
} satisfies Prisma.RepositorySelect;

export type RepositoryRow = Prisma.RepositoryGetPayload<{ select: typeof REPOSITORY_SELECT }>;

export const PULL_REQUEST_SELECT = {
  id: true,
  number: true,
  title: true,
  description: true,
  externalNumber: true,
  externalUrl: true,
  status: true,
  targetBranchName: true,
  reviewedAt: true,
  reviewComment: true,
  rejectionReason: true,
  mergedAt: true,
  createdAt: true,
  updatedAt: true,
  workItem: { select: { id: true, number: true, title: true, project: { select: { key: true } } } },
  repository: { select: { id: true, name: true, provider: true, url: true } },
  sourceBranch: { select: BRANCH_SELECT },
  targetBranch: { select: BRANCH_SELECT },
  declaredBy: { select: USER_SELECT },
  reviewedBy: { select: USER_SELECT },
  mergedBy: { select: USER_SELECT },
} satisfies Prisma.PullRequestSelect;

export type PullRequestRow = Prisma.PullRequestGetPayload<{ select: typeof PULL_REQUEST_SELECT }>;

export const PULL_REQUEST_DETAIL_SELECT = {
  ...PULL_REQUEST_SELECT,
  events: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      comment: true,
      createdAt: true,
      actor: { select: USER_SELECT },
    },
    orderBy: { createdAt: 'asc' },
  },
  comments: {
    select: {
      id: true,
      pullRequestId: true,
      body: true,
      createdAt: true,
      updatedAt: true,
      author: { select: USER_SELECT },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PullRequestSelect;

export type PullRequestDetailRow = Prisma.PullRequestGetPayload<{
  select: typeof PULL_REQUEST_DETAIL_SELECT;
}>;

export function toBranchSummary(row: BranchRow): BranchSummary {
  return {
    id: row.id,
    repositoryId: row.repositoryId,
    name: row.name,
    isLocalOnly: row.isLocalOnly,
    isProtected: row.isProtected,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toRepositorySummary(row: RepositoryRow): RepositorySummary {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    provider: row.provider as GitProvider,
    url: row.url,
    defaultBranch: row.defaultBranch,
    isArchived: row.isArchived,
    externalId: row.externalId,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    branchCount: row._count.branches,
    pullRequestCount: row._count.pullRequests,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPullRequestSummary(row: PullRequestRow): PullRequestSummary {
  return {
    id: row.id,
    number: row.number,
    workItem: {
      id: row.workItem.id,
      key: workItemKey(row.workItem.project.key, row.workItem.number),
      title: row.workItem.title,
    },
    repository: {
      id: row.repository.id,
      name: row.repository.name,
      provider: row.repository.provider as GitProvider,
      url: row.repository.url,
    },
    title: row.title,
    description: row.description,
    externalNumber: row.externalNumber,
    externalUrl: row.externalUrl,
    status: row.status as PullRequestStatus,
    sourceBranch: toBranchSummary(row.sourceBranch),
    targetBranch: row.targetBranch ? toBranchSummary(row.targetBranch) : null,
    targetBranchName: row.targetBranchName,
    declaredBy: row.declaredBy,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewComment: row.reviewComment,
    rejectionReason: row.rejectionReason,
    mergedBy: row.mergedBy,
    mergedAt: row.mergedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPullRequestEvent(row: PullRequestDetailRow['events'][number]): PullRequestEventSummary {
  return {
    id: row.id,
    fromStatus: row.fromStatus as PullRequestStatus | null,
    toStatus: row.toStatus as PullRequestStatus,
    comment: row.comment,
    actor: row.actor,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPullRequestComment(
  row: PullRequestDetailRow['comments'][number],
): PullRequestCommentSummary {
  return {
    id: row.id,
    pullRequestId: row.pullRequestId,
    body: row.body,
    author: row.author,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPullRequestDetail(row: PullRequestDetailRow): PullRequestDetail {
  return {
    ...toPullRequestSummary(row),
    events: row.events.map(toPullRequestEvent),
    comments: row.comments.map(toPullRequestComment),
  };
}

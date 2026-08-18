import { Prisma } from '@prisma/client';
import type {
  BranchSummary,
  GitProvider,
  PullRequestDetail,
  PullRequestEventSummary,
  PullRequestStatus,
  PullRequestSummary,
  RepositorySummary,
} from '@visiora/shared';
import { workItemKey } from '../work-items/work-item.mapper';

export const BRANCH_SELECT = {
  id: true,
  repositoryId: true,
  name: true,
  isLocalOnly: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.BranchSelect;

export type BranchRow = Prisma.BranchGetPayload<{ select: typeof BRANCH_SELECT }>;

export const REPOSITORY_SELECT = {
  id: true,
  projectId: true,
  name: true,
  provider: true,
  url: true,
  defaultBranch: true,
  externalId: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { branches: true, pullRequests: true } },
} satisfies Prisma.RepositorySelect;

export type RepositoryRow = Prisma.RepositoryGetPayload<{ select: typeof REPOSITORY_SELECT }>;

export const PULL_REQUEST_SELECT = {
  id: true,
  title: true,
  externalNumber: true,
  externalUrl: true,
  status: true,
  targetBranchName: true,
  reviewedAt: true,
  reviewComment: true,
  createdAt: true,
  updatedAt: true,
  workItem: { select: { id: true, number: true, title: true, project: { select: { key: true } } } },
  repository: { select: { id: true, name: true, provider: true, url: true } },
  sourceBranch: { select: BRANCH_SELECT },
  targetBranch: { select: BRANCH_SELECT },
  declaredBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
  reviewedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
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
      actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
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
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toRepositorySummary(row: RepositoryRow): RepositorySummary {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    provider: row.provider as GitProvider,
    url: row.url,
    defaultBranch: row.defaultBranch,
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

export function toPullRequestDetail(row: PullRequestDetailRow): PullRequestDetail {
  return {
    ...toPullRequestSummary(row),
    events: row.events.map(toPullRequestEvent),
  };
}

import type {
  BranchSummary,
  CreateBranchInput,
  CreatePullRequestInput,
  CreateRepositoryInput,
  PullRequestDetail,
  PullRequestSummary,
  RepositorySummary,
  UpdatePullRequestStatusInput,
} from '@visiora/shared';
import { api } from '@/lib/api-client';

export const reposApi = {
  repositories: (projectRef: string) =>
    api.get<RepositorySummary[]>(`/projects/${projectRef}/repositories`),

  createRepository: (projectRef: string, input: CreateRepositoryInput) =>
    api.post<RepositorySummary>(`/projects/${projectRef}/repositories`, input),

  branches: (projectRef: string, repositoryId: string) =>
    api.get<BranchSummary[]>(`/projects/${projectRef}/repositories/${repositoryId}/branches`),

  createBranch: (projectRef: string, repositoryId: string, input: CreateBranchInput) =>
    api.post<BranchSummary>(`/projects/${projectRef}/repositories/${repositoryId}/branches`, input),

  pullRequests: (projectRef: string) =>
    api.get<PullRequestSummary[]>(`/projects/${projectRef}/pull-requests`),

  createPullRequest: (projectRef: string, input: CreatePullRequestInput) =>
    api.post<PullRequestDetail>(`/projects/${projectRef}/pull-requests`, input),

  markReady: (projectRef: string, pullRequestId: string) =>
    api.patch<PullRequestDetail>(`/projects/${projectRef}/pull-requests/${pullRequestId}/ready`),

  review: (projectRef: string, pullRequestId: string, input: UpdatePullRequestStatusInput) =>
    api.patch<PullRequestDetail>(
      `/projects/${projectRef}/pull-requests/${pullRequestId}/review`,
      input,
    ),
};

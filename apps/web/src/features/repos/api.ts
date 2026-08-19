import type {
  BranchSummary,
  CreateBranchInput,
  CreatePullRequestCommentInput,
  CreatePullRequestInput,
  CreateRepositoryInput,
  PullRequestCommentSummary,
  PullRequestDetail,
  PullRequestStatus,
  PullRequestSummary,
  RepositorySummary,
  UpdatePullRequestStatusInput,
  UpdateRepositoryInput,
} from '@visiora/shared';
import { api } from '@/lib/api-client';

export const reposApi = {
  repositories: (projectRef: string) =>
    api.get<RepositorySummary[]>(`/projects/${projectRef}/repositories`),

  createRepository: (projectRef: string, input: CreateRepositoryInput) =>
    api.post<RepositorySummary>(`/projects/${projectRef}/repositories`, input),

  updateRepository: (projectRef: string, repositoryId: string, input: UpdateRepositoryInput) =>
    api.patch<RepositorySummary>(`/projects/${projectRef}/repositories/${repositoryId}`, input),

  deleteRepository: (projectRef: string, repositoryId: string) =>
    api.delete<{ ok: boolean }>(`/projects/${projectRef}/repositories/${repositoryId}`),

  branches: (projectRef: string, repositoryId: string) =>
    api.get<BranchSummary[]>(`/projects/${projectRef}/repositories/${repositoryId}/branches`),

  createBranch: (projectRef: string, repositoryId: string, input: CreateBranchInput) =>
    api.post<BranchSummary>(`/projects/${projectRef}/repositories/${repositoryId}/branches`, input),

  deleteBranch: (projectRef: string, repositoryId: string, branchId: string) =>
    api.delete<{ ok: boolean }>(`/projects/${projectRef}/repositories/${repositoryId}/branches/${branchId}`),

  pullRequests: (projectRef: string, filter?: { repositoryId?: string; status?: PullRequestStatus }) => {
    const params = new URLSearchParams();
    if (filter?.repositoryId) params.set('repositoryId', filter.repositoryId);
    if (filter?.status) params.set('status', filter.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<PullRequestSummary[]>(`/projects/${projectRef}/pull-requests${query}`);
  },

  pullRequestDetail: (projectRef: string, pullRequestId: string) =>
    api.get<PullRequestDetail>(`/projects/${projectRef}/pull-requests/${pullRequestId}`),

  createPullRequest: (projectRef: string, input: CreatePullRequestInput) =>
    api.post<PullRequestDetail>(`/projects/${projectRef}/pull-requests`, input),

  updatePullRequestStatus: (projectRef: string, pullRequestId: string, input: UpdatePullRequestStatusInput) =>
    api.patch<PullRequestDetail>(`/projects/${projectRef}/pull-requests/${pullRequestId}/status`, input),

  markReady: (projectRef: string, pullRequestId: string) =>
    api.post<PullRequestDetail>(`/projects/${projectRef}/pull-requests/${pullRequestId}/ready`),

  approve: (projectRef: string, pullRequestId: string, comment?: string) =>
    api.post<PullRequestDetail>(`/projects/${projectRef}/pull-requests/${pullRequestId}/approve`, {
      comment,
    }),

  requestChanges: (projectRef: string, pullRequestId: string, comment: string) =>
    api.post<PullRequestDetail>(`/projects/${projectRef}/pull-requests/${pullRequestId}/request-changes`, {
      comment,
    }),

  reject: (projectRef: string, pullRequestId: string, rejectionReason: string) =>
    api.post<PullRequestDetail>(`/projects/${projectRef}/pull-requests/${pullRequestId}/reject`, {
      rejectionReason,
    }),

  merge: (projectRef: string, pullRequestId: string) =>
    api.post<PullRequestDetail>(`/projects/${projectRef}/pull-requests/${pullRequestId}/merge`),

  close: (projectRef: string, pullRequestId: string) =>
    api.post<PullRequestDetail>(`/projects/${projectRef}/pull-requests/${pullRequestId}/close`),

  addComment: (projectRef: string, pullRequestId: string, input: CreatePullRequestCommentInput) =>
    api.post<PullRequestCommentSummary>(`/projects/${projectRef}/pull-requests/${pullRequestId}/comments`, input),
};

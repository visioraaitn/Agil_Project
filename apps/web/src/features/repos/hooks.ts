import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateBranchInput,
  CreatePullRequestCommentInput,
  CreatePullRequestInput,
  CreateRepositoryInput,
  PullRequestStatus,
  UpdateRepositoryInput,
} from '@visiora/shared';
import { reposApi } from './api';

export const repoKeys = {
  repositories: (projectRef: string) => ['projects', projectRef, 'repositories'] as const,
  branches: (projectRef: string, repositoryId: string) =>
    ['projects', projectRef, 'repositories', repositoryId, 'branches'] as const,
  pullRequests: (projectRef: string, filter?: { repositoryId?: string; status?: PullRequestStatus }) =>
    ['projects', projectRef, 'pull-requests', filter] as const,
  pullRequestDetail: (projectRef: string, pullRequestId: string) =>
    ['projects', projectRef, 'pull-requests', pullRequestId] as const,
};

export function useRepositories(projectRef: string) {
  return useQuery({
    queryKey: repoKeys.repositories(projectRef),
    queryFn: () => reposApi.repositories(projectRef),
  });
}

export function useBranches(projectRef: string, repositoryId: string | null) {
  return useQuery({
    queryKey: repoKeys.branches(projectRef, repositoryId ?? ''),
    queryFn: () => reposApi.branches(projectRef, repositoryId as string),
    enabled: Boolean(repositoryId),
  });
}

export function usePullRequests(
  projectRef: string,
  filter?: { repositoryId?: string; status?: PullRequestStatus },
) {
  return useQuery({
    queryKey: repoKeys.pullRequests(projectRef, filter),
    queryFn: () => reposApi.pullRequests(projectRef, filter),
  });
}

export function usePullRequestDetail(projectRef: string, pullRequestId: string | null) {
  return useQuery({
    queryKey: repoKeys.pullRequestDetail(projectRef, pullRequestId ?? ''),
    queryFn: () => reposApi.pullRequestDetail(projectRef, pullRequestId as string),
    enabled: Boolean(pullRequestId),
  });
}

function useInvalidateRepos(projectRef: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['projects', projectRef, 'repositories'] });
    queryClient.invalidateQueries({ queryKey: ['projects', projectRef, 'pull-requests'] });
  };
}

export function useCreateRepository(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: (input: CreateRepositoryInput) => reposApi.createRepository(projectRef, input),
    onSuccess: invalidate,
  });
}

export function useUpdateRepository(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: ({ repositoryId, input }: { repositoryId: string; input: UpdateRepositoryInput }) =>
      reposApi.updateRepository(projectRef, repositoryId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteRepository(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: (repositoryId: string) => reposApi.deleteRepository(projectRef, repositoryId),
    onSuccess: invalidate,
  });
}

export function useCreateBranch(projectRef: string, repositoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBranchInput) => reposApi.createBranch(projectRef, repositoryId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.branches(projectRef, repositoryId) });
      queryClient.invalidateQueries({ queryKey: repoKeys.repositories(projectRef) });
    },
  });
}

export function useDeleteBranch(projectRef: string, repositoryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) => reposApi.deleteBranch(projectRef, repositoryId, branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.branches(projectRef, repositoryId) });
      queryClient.invalidateQueries({ queryKey: repoKeys.repositories(projectRef) });
    },
  });
}

export function useCreatePullRequest(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: (input: CreatePullRequestInput) => reposApi.createPullRequest(projectRef, input),
    onSuccess: invalidate,
  });
}

export function useMarkPullRequestReady(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: (pullRequestId: string) => reposApi.markReady(projectRef, pullRequestId),
    onSuccess: invalidate,
  });
}

export function useApprovePullRequest(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: ({ pullRequestId, comment }: { pullRequestId: string; comment?: string }) =>
      reposApi.approve(projectRef, pullRequestId, comment),
    onSuccess: invalidate,
  });
}

export function useRequestChangesPullRequest(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: ({ pullRequestId, comment }: { pullRequestId: string; comment: string }) =>
      reposApi.requestChanges(projectRef, pullRequestId, comment),
    onSuccess: invalidate,
  });
}

export function useRejectPullRequest(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: ({ pullRequestId, rejectionReason }: { pullRequestId: string; rejectionReason: string }) =>
      reposApi.reject(projectRef, pullRequestId, rejectionReason),
    onSuccess: invalidate,
  });
}

export function useMergePullRequest(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: (pullRequestId: string) => reposApi.merge(projectRef, pullRequestId),
    onSuccess: invalidate,
  });
}

export function useClosePullRequest(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: (pullRequestId: string) => reposApi.close(projectRef, pullRequestId),
    onSuccess: invalidate,
  });
}

export function useAddPullRequestComment(projectRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pullRequestId,
      input,
    }: {
      pullRequestId: string;
      input: CreatePullRequestCommentInput;
    }) => reposApi.addComment(projectRef, pullRequestId, input),
    onSuccess: (_, { pullRequestId }) => {
      queryClient.invalidateQueries({ queryKey: repoKeys.pullRequestDetail(projectRef, pullRequestId) });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateBranchInput,
  CreatePullRequestInput,
  CreateRepositoryInput,
  UpdatePullRequestStatusInput,
} from '@visiora/shared';
import { reposApi } from './api';

export const repoKeys = {
  repositories: (projectRef: string) => ['projects', projectRef, 'repositories'] as const,
  branches: (projectRef: string, repositoryId: string) =>
    ['projects', projectRef, 'repositories', repositoryId, 'branches'] as const,
  pullRequests: (projectRef: string) => ['projects', projectRef, 'pull-requests'] as const,
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

export function usePullRequests(projectRef: string) {
  return useQuery({
    queryKey: repoKeys.pullRequests(projectRef),
    queryFn: () => reposApi.pullRequests(projectRef),
  });
}

function useInvalidateRepos(projectRef: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['projects', projectRef] });
}

export function useCreateRepository(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: (input: CreateRepositoryInput) => reposApi.createRepository(projectRef, input),
    onSuccess: invalidate,
  });
}

export function useCreateBranch(projectRef: string, repositoryId: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: (input: CreateBranchInput) => reposApi.createBranch(projectRef, repositoryId, input),
    onSuccess: invalidate,
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

export function useReviewPullRequest(projectRef: string) {
  const invalidate = useInvalidateRepos(projectRef);
  return useMutation({
    mutationFn: ({
      pullRequestId,
      input,
    }: {
      pullRequestId: string;
      input: UpdatePullRequestStatusInput;
    }) => reposApi.review(projectRef, pullRequestId, input),
    onSuccess: invalidate,
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CloseSprintInput,
  CreateSprintInput,
  ListSprintsQuery,
  UpdateRetrospectiveInput,
  UpdateSprintInput,
} from '@visiora/shared';
import { sprintsApi } from './api';

export const sprintKeys = {
  list: (projectRef: string, query: ListSprintsQuery = {}) =>
    ['projects', projectRef, 'sprints', query] as const,
  detail: (projectRef: string, sprintId: string) =>
    ['projects', projectRef, 'sprints', sprintId] as const,
  roadmap: (projectRef: string) => ['projects', projectRef, 'roadmap'] as const,
};

export function useSprints(projectRef: string, query: ListSprintsQuery = {}) {
  return useQuery({
    queryKey: sprintKeys.list(projectRef, query),
    queryFn: () => sprintsApi.list(projectRef, query),
  });
}

export function useSprint(projectRef: string, sprintId: string | null) {
  return useQuery({
    queryKey: sprintKeys.detail(projectRef, sprintId ?? ''),
    queryFn: () => sprintsApi.getOne(projectRef, sprintId as string),
    enabled: Boolean(sprintId),
  });
}

export function useRoadmap(projectRef: string) {
  return useQuery({
    queryKey: sprintKeys.roadmap(projectRef),
    queryFn: () => sprintsApi.roadmap(projectRef),
  });
}

function useInvalidateSprints(projectRef: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['projects', projectRef] });
}

export function useCreateSprint(projectRef: string) {
  const invalidate = useInvalidateSprints(projectRef);
  return useMutation({
    mutationFn: (input: CreateSprintInput) => sprintsApi.create(projectRef, input),
    onSuccess: invalidate,
  });
}

export function useUpdateSprint(projectRef: string) {
  const invalidate = useInvalidateSprints(projectRef);
  return useMutation({
    mutationFn: ({ sprintId, input }: { sprintId: string; input: UpdateSprintInput }) =>
      sprintsApi.update(projectRef, sprintId, input),
    onSuccess: invalidate,
  });
}

export function useCloseSprint(projectRef: string) {
  const invalidate = useInvalidateSprints(projectRef);
  return useMutation({
    mutationFn: ({ sprintId, input }: { sprintId: string; input: CloseSprintInput }) =>
      sprintsApi.close(projectRef, sprintId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateRetrospective(projectRef: string) {
  const invalidate = useInvalidateSprints(projectRef);
  return useMutation({
    mutationFn: ({ sprintId, input }: { sprintId: string; input: UpdateRetrospectiveInput }) =>
      sprintsApi.updateRetrospective(projectRef, sprintId, input),
    onSuccess: invalidate,
  });
}

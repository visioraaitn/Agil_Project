import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Inutile de réessayer une erreur de droits ou une ressource absente.
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

/**
 * Clés de cache centralisées : invalider devient explicite et sans faute de frappe.
 * Ex. queryClient.invalidateQueries({ queryKey: queryKeys.backlog(projectId) })
 */
export const queryKeys = {
  session: ['session'] as const,
  projects: ['projects'] as const,
  project: (projectId: string) => ['projects', projectId] as const,
  projectMembers: (projectId: string) => ['projects', projectId, 'members'] as const,
  backlog: (projectId: string) => ['projects', projectId, 'backlog'] as const,
  board: (projectId: string, sprintId?: string) =>
    ['projects', projectId, 'board', sprintId ?? 'active'] as const,
  workItem: (workItemId: string) => ['work-items', workItemId] as const,
  sprints: (projectId: string) => ['projects', projectId, 'sprints'] as const,
  notifications: ['notifications'] as const,
};

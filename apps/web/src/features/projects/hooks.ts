import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  ListProjectsQuery,
  Permission,
  ProjectRole,
  UpdateProjectInput,
  UpdateProjectMemberInput,
} from '@visiora/shared';
import { queryKeys } from '@/lib/query-client';
import { projectsApi } from './api';

export function useProjects(filters: Partial<ListProjectsQuery> = {}) {
  return useQuery({
    queryKey: queryKeys.projectList(filters),
    queryFn: () => projectsApi.list(filters),
  });
}

export function useProject(projectRef: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(projectRef ?? ''),
    queryFn: () => projectsApi.getOne(projectRef as string),
    enabled: Boolean(projectRef),
  });
}

/**
 * Droits effectifs de l'utilisateur sur le projet, tels que le serveur les
 * calcule. L'UI s'en sert uniquement pour masquer ou désactiver les commandes :
 * l'API reste seule juge et refuse les requêtes non autorisées.
 */
export function useProjectPermissions(projectRef: string | undefined): {
  can: (permission: Permission) => boolean;
  role: ProjectRole | null;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: queryKeys.projectAccess(projectRef ?? ''),
    queryFn: () => projectsApi.getAccess(projectRef as string),
    enabled: Boolean(projectRef),
  });

  return {
    can: (permission) => query.data?.permissions.includes(permission) ?? false,
    role: query.data?.role ?? null,
    isLoading: query.isLoading,
  };
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useUpdateProject(projectRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => projectsApi.update(projectRef, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useProjectMembers(projectRef: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projectMembers(projectRef ?? ''),
    queryFn: () => projectsApi.listMembers(projectRef as string),
    enabled: Boolean(projectRef),
  });
}

/**
 * Après toute modification de membre, on invalide aussi `access` : changer son
 * propre rôle change immédiatement ses permissions, et l'UI doit suivre.
 */
function useMemberMutation<TVariables>(
  projectRef: string,
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projectMembers(projectRef) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projectAccess(projectRef) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
      ]);
    },
  });
}

export function useAddMember(projectRef: string) {
  return useMemberMutation<AddProjectMemberInput>(projectRef, (input) =>
    projectsApi.addMember(projectRef, input),
  );
}

export function useUpdateMember(projectRef: string) {
  return useMemberMutation<{ userId: string; input: UpdateProjectMemberInput }>(
    projectRef,
    ({ userId, input }) => projectsApi.updateMember(projectRef, userId, input),
  );
}

export function useRemoveMember(projectRef: string) {
  return useMemberMutation<string>(projectRef, (userId) =>
    projectsApi.removeMember(projectRef, userId),
  );
}

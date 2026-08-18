import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from '@visiora/shared';
import { queryKeys } from '@/lib/query-client';
import { usersApi } from './api';

/** Annuaire des comptes actifs — utilisable par n'importe quel membre. */
export function useUserDirectory(search?: string, enabled = true) {
  return useQuery({
    queryKey: ['users', 'directory', search ?? ''] as const,
    queryFn: () => usersApi.directory(search),
    enabled,
  });
}

/** Liste complète — réservée aux administrateurs (`user:manage`). */
export function useUsers(filters: Partial<ListUsersQuery> = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.users(filters),
    queryFn: () => usersApi.list(filters),
    enabled,
  });
}

function useUserMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useCreateUser() {
  return useUserMutation<CreateUserInput>((input) => usersApi.create(input));
}

export function useUpdateUser() {
  return useUserMutation<{ userId: string; input: UpdateUserInput }>(({ userId, input }) =>
    usersApi.update(userId, input),
  );
}

export function useDeleteUser() {
  return useUserMutation<string>((userId) => usersApi.remove(userId));
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      usersApi.resetPassword(userId, newPassword),
  });
}

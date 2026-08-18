import type {
  CreateUserInput,
  ListUsersQuery,
  Paginated,
  UpdateUserInput,
  UpdateProfileInput,
  UserDirectoryEntry,
  UserSummary,
} from '@visiora/shared';
import { api } from '@/lib/api-client';

export const usersApi = {
  /** Annuaire léger — accessible à tout utilisateur authentifié. */
  directory: (search?: string) =>
    api.get<UserDirectoryEntry[]>('/users/directory', { query: { search } }),

  list: (query: Partial<ListUsersQuery> = {}) =>
    api.get<Paginated<UserSummary>>('/users', {
      query: {
        page: query.page,
        pageSize: query.pageSize,
        search: query.search,
        globalRole: query.globalRole,
        isActive: query.isActive === undefined ? undefined : String(query.isActive),
      },
    }),

  create: (input: CreateUserInput) => api.post<UserSummary>('/users', input),

  updateProfile: (input: UpdateProfileInput) => api.patch<UserSummary>('/users/me', input),

  update: (userId: string, input: UpdateUserInput) =>
    api.patch<UserSummary>(`/users/${userId}`, input),

  resetPassword: (userId: string, newPassword: string) =>
    api.post<void>(`/users/${userId}/reset-password`, { newPassword }),

  remove: (userId: string) => api.delete<void>(`/users/${userId}`),
};

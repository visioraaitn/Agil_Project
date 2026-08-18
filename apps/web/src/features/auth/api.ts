import type { AuthenticatedUser, ChangePasswordInput, LoginInput, SessionResponse } from '@visiora/shared';
import { api, apiFetch } from '@/lib/api-client';

export const authApi = {
  login: (input: LoginInput) => api.post<SessionResponse>('/auth/login', input),

  /**
   * Restaure la session au chargement de l'application à partir du cookie
   * httpOnly. `skipRefresh` évite que l'intercepteur 401 ne rappelle /refresh
   * en boucle quand il n'y a justement aucune session.
   */
  restore: () => apiFetch<SessionResponse>('/auth/refresh', { method: 'POST', skipRefresh: true }),

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<AuthenticatedUser>('/auth/me'),

  changePassword: (input: ChangePasswordInput) => api.post<void>('/auth/change-password', input),
};

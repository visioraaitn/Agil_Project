import type {
  AuthenticatedUser,
  ChangePasswordInput,
  LoginInput,
  SessionResponse,
} from '@visiora/shared';
import { api, apiFetch } from '@/lib/api-client';

let pendingRestore: Promise<SessionResponse> | null = null;

function restoreSession(): Promise<SessionResponse> {
  // StrictMode peut monter deux fois le provider : un refresh token ne doit
  // être consommé qu'une fois, sinon la rotation invalide la session.
  pendingRestore ??= apiFetch<SessionResponse>('/auth/refresh', {
    method: 'POST',
    skipRefresh: true,
  }).finally(() => {
    pendingRestore = null;
  });
  return pendingRestore;
}

export const authApi = {
  login: (input: LoginInput) =>
    apiFetch<SessionResponse>('/auth/login', { method: 'POST', body: input, skipRefresh: true }),

  /**
   * Restaure la session au chargement de l'application à partir du cookie
   * httpOnly. `skipRefresh` évite que l'intercepteur 401 ne rappelle /refresh
   * en boucle quand il n'y a justement aucune session.
   */
  restore: restoreSession,

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<AuthenticatedUser>('/auth/me'),

  changePassword: (input: ChangePasswordInput) => api.post<void>('/auth/change-password', input),
};

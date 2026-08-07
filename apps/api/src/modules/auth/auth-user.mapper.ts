import { AuthenticatedUser, GlobalRole } from '@visiora/shared';

export interface AuthUserRow {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  globalRole: string;
}

/** Projection de la ligne `User` vers la forme exposée au client. */
export function toAuthenticatedUser(user: AuthUserRow): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    globalRole: user.globalRole as GlobalRole,
  };
}

import { AuthenticatedUser, GlobalRole, isUserFunction } from '@visiora/shared';

export interface AuthUserRow {
  id: string;
  email: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  globalRole: string;
  isSuperAdmin: boolean;
}

/** Projection de la ligne `User` vers la forme exposée au client. */
export function toAuthenticatedUser(user: AuthUserRow): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    jobTitle: isUserFunction(user.jobTitle) ? user.jobTitle : null,
    avatarUrl: user.avatarUrl,
    globalRole: user.globalRole as GlobalRole,
    isSuperAdmin: user.isSuperAdmin,
  };
}

import type { Permission } from '../permissions';
import type { GlobalRole, ProjectRole, UserFunction } from '../enums';

/** Enveloppe d'erreur normalisée renvoyée par l'API (AllExceptionsFilter). */
export interface ApiErrorBody {
  statusCode: number;
  /** Code applicatif stable, ex. `PROJECT_KEY_TAKEN` — le front s'y accroche. */
  code: string;
  message: string;
  /**
   * Erreurs de validation Zod (indexées par chemin de champ, valeur `string[]`)
   * ou charge utile structurée propre à un code applicatif donné — ex.
   * `SPRINT_PROPAGATION_CONFIRMATION_REQUIRED` y place la liste des conflits.
   */
  details?: Record<string, unknown>;
  timestamp: string;
  path: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  jobTitle: UserFunction | null;
  avatarUrl: string | null;
  globalRole: GlobalRole;
  /** Privilège protégé autorisant la gestion des autres administrateurs. */
  isSuperAdmin: boolean;
}

export interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthenticatedUser;
}

/** Droits de l'utilisateur courant sur un projet donné. */
export interface ProjectAccess {
  projectId: string;
  role: ProjectRole | null;
  permissions: Permission[];
}

import { GlobalRole, ProjectRole } from './enums';

/**
 * A.2 · Matrice de permissions.
 *
 * Source de vérité unique, partagée par le guard NestJS et l'UI React :
 * le serveur l'applique, le client s'en sert seulement pour masquer/désactiver
 * les commandes. Le client n'est jamais la sécurité.
 *
 * La lecture d'un projet est implicite : être membre suffit.
 */
export const PERMISSIONS = [
  // Plateforme (réservé au GlobalRole ADMIN)
  'user:manage',
  'project:create',
  'project:delete',

  // Projet
  'project:update',
  'project:member:manage',
  // Dépôts & Branches
  'repo:manage',
  'branch:create',
  'branch:delete',
  'label:manage',

  // Backlog & tickets
  'workitem:create',
  'workitem:update',
  'workitem:delete',
  'workitem:assign',
  'workitem:move', // déplacer sur le board (changer de statut)
  'backlog:reorder',
  'attachment:manage',

  // Sprints
  'sprint:manage',
  'sprint:close',
  'retro:manage',

  // Pull requests (Workflow Azure DevOps)
  'pr:declare',
  'pr:approve',
  'pr:review',
  'pr:merge',
  'pr:close',
  'pr:comment',

  // Collaboration
  'comment:create',
  'comment:delete:any',

  // Reporting
  'report:view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PRODUCT_OWNER_PERMISSIONS: readonly Permission[] = [
  'project:update',
  'project:member:manage',
  'repo:manage',
  'branch:create',
  'branch:delete',
  'label:manage',
  'workitem:create',
  'workitem:update',
  'workitem:delete',
  'workitem:assign',
  'workitem:move',
  'backlog:reorder',
  'attachment:manage',
  'sprint:manage',
  'sprint:close',
  'retro:manage',
  'pr:declare',
  'pr:approve',
  'pr:review',
  'pr:merge',
  'pr:close',
  'pr:comment',
  'comment:create',
  'comment:delete:any',
  'report:view',
];

const SCRUM_MASTER_PERMISSIONS: readonly Permission[] = [
  'project:member:manage',
  'branch:create',
  'label:manage',
  'workitem:create',
  'workitem:update',
  'workitem:delete',
  'workitem:assign',
  'workitem:move',
  'backlog:reorder',
  'attachment:manage',
  'sprint:manage',
  'sprint:close',
  'retro:manage',
  'pr:declare',
  'pr:review',
  'pr:close',
  'pr:comment',
  'comment:create',
  'comment:delete:any',
  'report:view',
];

const DEVELOPER_PERMISSIONS: readonly Permission[] = [
  'branch:create',
  'branch:delete',
  'workitem:create',
  'workitem:update',
  'workitem:assign',
  'workitem:move',
  'attachment:manage',
  'retro:manage',
  'pr:declare',
  'pr:close',
  'pr:comment',
  'comment:create',
  'report:view',
];

const VIEWER_PERMISSIONS: readonly Permission[] = ['report:view'];

export const ROLE_PERMISSIONS: Record<ProjectRole, readonly Permission[]> = {
  [ProjectRole.PRODUCT_OWNER]: PRODUCT_OWNER_PERMISSIONS,
  [ProjectRole.SCRUM_MASTER]: SCRUM_MASTER_PERMISSIONS,
  [ProjectRole.DEVELOPER]: DEVELOPER_PERMISSIONS,
  [ProjectRole.VIEWER]: VIEWER_PERMISSIONS,
};

/** Permissions accordées au seul GlobalRole ADMIN, hors de tout projet. */
export const PLATFORM_PERMISSIONS: readonly Permission[] = [
  'user:manage',
  'project:create',
  'project:delete',
];

export interface AccessContext {
  globalRole: GlobalRole;
  /** Rôle sur le projet concerné ; `null` si l'utilisateur n'en est pas membre. */
  projectRole?: ProjectRole | null;
}

/**
 * Vérifie une permission. L'ADMIN plateforme passe partout : instance interne
 * mono-organisation, il est l'exploitant de la plateforme.
 */
export function can(ctx: AccessContext, permission: Permission): boolean {
  if (ctx.globalRole === GlobalRole.ADMIN) return true;
  if (PLATFORM_PERMISSIONS.includes(permission)) return false;
  if (!ctx.projectRole) return false;
  return ROLE_PERMISSIONS[ctx.projectRole].includes(permission);
}

export function canAll(ctx: AccessContext, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => can(ctx, p));
}

export function canAny(ctx: AccessContext, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(ctx, p));
}

/** Liste effective, pratique pour envoyer les droits au front à la connexion. */
export function permissionsFor(ctx: AccessContext): Permission[] {
  return PERMISSIONS.filter((p) => can(ctx, p));
}

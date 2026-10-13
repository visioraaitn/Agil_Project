import { GlobalRole, ProjectRole } from './enums';

/**
 * A.2 · Matrice de permissions.
 *
 * Source de vérité unique, partagée par le guard NestJS et l'UI React :
 * le serveur l'applique, le client s'en sert seulement pour masquer/désactiver
 * les commandes. Le client n'est jamais la sécurité.
 *
 * Trois niveaux, refus par défaut :
 * - **Super administrateur** (`GlobalRole.ADMIN` + `isSuperAdmin`) : voit et
 *   administre tous les projets ; seul à créer un projet et à en gérer les membres.
 * - **Administrateur** (`GlobalRole.ADMIN`) : comptes de la plateforme, et
 *   administration complète des seuls projets dont il est membre.
 * - **Membre** (`GlobalRole.MEMBER`) : droits de son rôle projet, sans jamais
 *   administrer le projet, ses sprints ni l'import, quel que soit ce rôle.
 *
 * La lecture d'un projet est implicite : être membre suffit (`hasProjectAccess`).
 */
export const PERMISSIONS = [
  // Plateforme
  'user:manage',
  'project:create',
  'project:member:manage',

  // Administration d'un projet
  'project:delete',
  'project:document:manage',
  'project:update',
  'workitem:import',

  // Dépôts & Branches
  'repo:manage',
  'branch:create',
  'branch:delete',
  'label:manage',
  'tag:manage',

  // Backlog & tickets
  'workitem:create',
  'workitem:update',
  'workitem:delete',
  'workitem:assign',
  'workitem:move', // déplacer sur le board (changer de statut)
  'board:configure', // colonnes du board : ajout, renommage, ordre, limites WIP
  'backlog:reorder',
  'attachment:manage',

  // Sprints
  'sprint:manage',
  'sprint:close',
  'sprint:plan', // composition d'un sprint : y affecter ou en retirer des tickets
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

/** Réservé au super administrateur, seul à voir tous les projets. */
export const SUPER_ADMIN_PERMISSIONS: readonly Permission[] = [
  'project:create',
  'project:member:manage',
];

/** Accordé à tout administrateur, hors de tout projet. */
export const PLATFORM_PERMISSIONS: readonly Permission[] = ['user:manage'];

/**
 * Administration d'un projet : un administrateur membre du projet (ou le super
 * administrateur). Jamais accordée à un `GlobalRole.MEMBER`, même Project Lead.
 */
export const PROJECT_ADMIN_PERMISSIONS: readonly Permission[] = [
  'project:update',
  'project:delete',
  'project:document:manage',
  'workitem:import',
  'sprint:manage',
  'sprint:close',
  'sprint:plan',
];

const PROJECT_LEAD_PERMISSIONS: readonly Permission[] = [
  'board:configure',
  'repo:manage',
  'branch:create',
  'branch:delete',
  'label:manage',
  'tag:manage',
  'workitem:create',
  'workitem:update',
  'workitem:delete',
  'workitem:assign',
  'workitem:move',
  'backlog:reorder',
  'attachment:manage',
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

const MEMBER_PERMISSIONS: readonly Permission[] = [
  'branch:create',
  'branch:delete',
  'label:manage',
  'tag:manage',
  'workitem:create',
  'workitem:update',
  'workitem:delete',
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

/** Droits d'un `GlobalRole.MEMBER` selon son rôle sur le projet. */
export const ROLE_PERMISSIONS: Record<ProjectRole, readonly Permission[]> = {
  [ProjectRole.PROJECT_LEAD]: PROJECT_LEAD_PERMISSIONS,
  [ProjectRole.MEMBER]: MEMBER_PERMISSIONS,
};

export interface AccessContext {
  globalRole: GlobalRole;
  /** Super administrateur ; absent = non. */
  isSuperAdmin?: boolean;
  /** Rôle sur le projet concerné ; `null` si l'utilisateur n'en est pas membre. */
  projectRole?: ProjectRole | null;
}

/** Le drapeau `isSuperAdmin` n'a d'effet que sur un compte ADMIN. */
export function isSuperAdministrator(subject: {
  globalRole: GlobalRole;
  isSuperAdmin?: boolean;
}): boolean {
  return subject.globalRole === GlobalRole.ADMIN && subject.isSuperAdmin === true;
}

/**
 * Accès en lecture à un projet : le super administrateur partout, les autres
 * seulement sur les projets dont ils sont membres. Rôle inconnu = refus.
 */
export function hasProjectAccess(ctx: AccessContext): boolean {
  if (isSuperAdministrator(ctx)) return true;
  if (ctx.globalRole !== GlobalRole.ADMIN && ctx.globalRole !== GlobalRole.MEMBER) return false;
  return Boolean(ctx.projectRole);
}

export function can(ctx: AccessContext, permission: Permission): boolean {
  if (isSuperAdministrator(ctx)) return true;
  if (SUPER_ADMIN_PERMISSIONS.includes(permission)) return false;

  if (ctx.globalRole === GlobalRole.ADMIN) {
    if (PLATFORM_PERMISSIONS.includes(permission)) return true;
    // Tout le projet, mais seulement là où il est membre.
    return Boolean(ctx.projectRole);
  }

  if (ctx.globalRole !== GlobalRole.MEMBER || !ctx.projectRole) return false;
  if (PLATFORM_PERMISSIONS.includes(permission)) return false;
  if (PROJECT_ADMIN_PERMISSIONS.includes(permission)) return false;
  const granted = ROLE_PERMISSIONS[ctx.projectRole] as readonly Permission[] | undefined;
  return granted?.includes(permission) ?? false;
}

export function isPlatformAdministrator(role: GlobalRole): boolean {
  return role === GlobalRole.ADMIN;
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

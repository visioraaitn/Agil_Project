/**
 * Miroir des enums Prisma, utilisable côté navigateur (le front ne doit jamais
 * importer @prisma/client). Toute modification ici doit être répercutée dans
 * apps/api/prisma/schema.prisma — le test `enums.spec.ts` côté API vérifie la
 * cohérence des deux listes.
 */

export const GlobalRole = {
  PRODUCT_OWNER: 'PRODUCT_OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;
export type GlobalRole = (typeof GlobalRole)[keyof typeof GlobalRole];

/** Fonction professionnelle affichée sur le profil, sans effet sur les permissions. */
export const UserFunction = {
  FULL_STACK_DEVELOPER: 'FULL_STACK_DEVELOPER',
  PRODUCT_OWNER: 'PRODUCT_OWNER',
  FRONTEND_DEVELOPER: 'FRONTEND_DEVELOPER',
  BACKEND_DEVELOPER: 'BACKEND_DEVELOPER',
  AI_DEVELOPER: 'AI_DEVELOPER',
  CLOUD_DEVOPS: 'CLOUD_DEVOPS',
  SECURITY: 'SECURITY',
  INTERN: 'INTERN',
  CLIENT: 'CLIENT',
} as const;
export type UserFunction = (typeof UserFunction)[keyof typeof UserFunction];

export function isUserFunction(value: unknown): value is UserFunction {
  return typeof value === 'string' && Object.values(UserFunction).includes(value as UserFunction);
}

export const ProjectRole = {
  PRODUCT_OWNER: 'PRODUCT_OWNER',
  SCRUM_MASTER: 'SCRUM_MASTER',
  DEVELOPER: 'DEVELOPER',
  VIEWER: 'VIEWER',
} as const;
export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];

export const ProjectStatus = {
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const WorkItemType = {
  EPIC: 'EPIC',
  STORY: 'STORY',
  SUBTASK: 'SUBTASK',
  BUG: 'BUG',
} as const;
export type WorkItemType = (typeof WorkItemType)[keyof typeof WorkItemType];

/** D.1 · Colonnes du Task Board, dans l'ordre d'affichage. */
export const WorkItemStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_TEST: 'IN_TEST',
  READY_FOR_APPROVAL: 'READY_FOR_APPROVAL',
  DONE: 'DONE',
} as const;
export type WorkItemStatus = (typeof WorkItemStatus)[keyof typeof WorkItemStatus];

export const BOARD_COLUMNS: readonly WorkItemStatus[] = [
  WorkItemStatus.TODO,
  WorkItemStatus.IN_PROGRESS,
  WorkItemStatus.IN_TEST,
  WorkItemStatus.READY_FOR_APPROVAL,
  WorkItemStatus.DONE,
];

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const SprintStatus = {
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
} as const;
export type SprintStatus = (typeof SprintStatus)[keyof typeof SprintStatus];

export const RetroCategory = {
  WENT_WELL: 'WENT_WELL',
  TO_IMPROVE: 'TO_IMPROVE',
  ACTION_ITEM: 'ACTION_ITEM',
} as const;
export type RetroCategory = (typeof RetroCategory)[keyof typeof RetroCategory];

export const GitProvider = {
  GITHUB: 'GITHUB',
  GITLAB: 'GITLAB',
  BITBUCKET: 'BITBUCKET',
  AZURE_DEVOPS: 'AZURE_DEVOPS',
  OTHER: 'OTHER',
} as const;
export type GitProvider = (typeof GitProvider)[keyof typeof GitProvider];

export const PullRequestStatus = {
  OPEN: 'OPEN',
  READY_FOR_APPROVAL: 'READY_FOR_APPROVAL',
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  REJECTED: 'REJECTED',
  MERGED: 'MERGED',
  CLOSED: 'CLOSED',
} as const;
export type PullRequestStatus = (typeof PullRequestStatus)[keyof typeof PullRequestStatus];

export const EntityType = {
  PROJECT: 'PROJECT',
  WORK_ITEM: 'WORK_ITEM',
  SPRINT: 'SPRINT',
  PULL_REQUEST: 'PULL_REQUEST',
  COMMENT: 'COMMENT',
  USER: 'USER',
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const NotificationType = {
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  ITEM_ASSIGNED: 'ITEM_ASSIGNED',
  ITEM_STATUS_CHANGED: 'ITEM_STATUS_CHANGED',
  ITEM_COMMENTED: 'ITEM_COMMENTED',
  ITEM_MENTIONED: 'ITEM_MENTIONED',
  PR_CREATED: 'PR_CREATED',
  PR_DECLARED: 'PR_DECLARED',
  PR_READY_FOR_APPROVAL: 'PR_READY_FOR_APPROVAL',
  PR_APPROVED: 'PR_APPROVED',
  PR_CHANGES_REQUESTED: 'PR_CHANGES_REQUESTED',
  PR_REJECTED: 'PR_REJECTED',
  PR_MERGED: 'PR_MERGED',
  PR_CLOSED: 'PR_CLOSED',
  PR_COMMENTED: 'PR_COMMENTED',
  SPRINT_STARTED: 'SPRINT_STARTED',
  SPRINT_CLOSED: 'SPRINT_CLOSED',
  PROJECT_MEMBER_ADDED: 'PROJECT_MEMBER_ADDED',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** D.2 · Échelle d'estimation proposée dans l'UI. */
export const STORY_POINT_SCALE = [1, 2, 3, 5, 8, 13, 21] as const;

/** Libellés FR — l'API renvoie toujours les codes, jamais le texte affiché. */
export const LABELS_FR = {
  userFunction: {
    FULL_STACK_DEVELOPER: 'Développeur full-stack',
    PRODUCT_OWNER: 'Product Owner',
    FRONTEND_DEVELOPER: 'Développeur frontend',
    BACKEND_DEVELOPER: 'Développeur backend',
    AI_DEVELOPER: 'Développeur IA',
    CLOUD_DEVOPS: 'Cloud & DevOps',
    SECURITY: 'Sécurité',
    INTERN: 'Stagiaire',
    CLIENT: 'Client',
  },
  projectRole: {
    PRODUCT_OWNER: 'Product Owner',
    SCRUM_MASTER: 'Scrum Master',
    DEVELOPER: 'Développeur',
    VIEWER: 'Lecteur',
  },
  workItemType: {
    EPIC: 'Epic',
    STORY: 'User Story',
    SUBTASK: 'Sous-tâche',
    BUG: 'Bug',
  },
  workItemStatus: {
    TODO: 'À faire',
    IN_PROGRESS: 'En cours',
    IN_TEST: 'En test',
    READY_FOR_APPROVAL: 'Prêt pour approbation',
    DONE: 'Terminé',
  },
  priority: {
    LOW: 'Basse',
    MEDIUM: 'Moyenne',
    HIGH: 'Haute',
    CRITICAL: 'Critique',
  },
  sprintStatus: {
    PLANNED: 'Planifié',
    ACTIVE: 'Actif',
    COMPLETED: 'Terminé',
  },
  pullRequestStatus: {
    OPEN: 'Ouverte',
    READY_FOR_APPROVAL: 'En attente de revue',
    APPROVED: 'Approuvée',
    CHANGES_REQUESTED: 'Modifications demandées',
    REJECTED: 'Rejetée',
    MERGED: 'Fusionnée',
    CLOSED: 'Fermée',
  },
  retroCategory: {
    WENT_WELL: 'Ce qui a bien marché',
    TO_IMPROVE: 'À améliorer',
    ACTION_ITEM: "Action d'amélioration",
  },
} as const;

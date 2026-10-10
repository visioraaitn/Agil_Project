import { z } from 'zod';
import { Priority, WorkItemStatus, WorkItemType } from '../enums';
import { uuidSchema } from './common';
import type { UserDirectoryEntry } from './user';
import type { TagSummary } from './tag';

/**
 * C.1 · Hiérarchie autorisée. Un EPIC est toujours racine ; une STORY se range
 * sous un EPIC ; une SUBTASK et un BUG appartiennent toujours à une STORY — ce
 * sont les cartes du Task Board, la STORY en est la ligne. Cette table est la
 * seule autorité — le service la consulte avant d'accepter un `parentId`.
 */
export const ALLOWED_PARENT_TYPES: Record<WorkItemType, readonly WorkItemType[]> = {
  [WorkItemType.EPIC]: [],
  [WorkItemType.STORY]: [WorkItemType.EPIC],
  [WorkItemType.BUG]: [WorkItemType.STORY],
  [WorkItemType.SUBTASK]: [WorkItemType.STORY],
};

/** Types dont le parent est obligatoire. */
export const REQUIRES_PARENT: readonly WorkItemType[] = [WorkItemType.SUBTASK, WorkItemType.BUG];

export function canBeChildOf(childType: WorkItemType, parentType: WorkItemType): boolean {
  return ALLOWED_PARENT_TYPES[childType].includes(parentType);
}

/** Cartes du Task Board : les sous-tâches et bugs d'une User Story. */
export const BOARD_CARD_TYPES: readonly WorkItemType[] = [WorkItemType.SUBTASK, WorkItemType.BUG];

/**
 * D.1 · Enfants dont le statut fait avancer un parent : les cartes d'une
 * User Story, les User Stories d'un Epic. Les autres types n'ont pas de statut
 * déduit.
 */
export const STATUS_ROLLUP_CHILD_TYPES: Partial<Record<WorkItemType, readonly WorkItemType[]>> = {
  [WorkItemType.STORY]: BOARD_CARD_TYPES,
  [WorkItemType.EPIC]: [WorkItemType.STORY],
};

/**
 * D.1 · Statut d'un parent (User Story ou Epic) déduit de ses enfants.
 * Renvoie le statut à appliquer, ou `null` si le parent doit rester tel quel :
 * - tous les enfants terminés → « Terminé » ;
 * - parent « Terminé » avec un enfant non terminé → « En cours » ;
 * - parent « À faire » avec un enfant engagé (hors « À faire ») → « En cours ».
 * Sans enfant, rien n'est déduit : le parent garde le statut posé à la main.
 */
export function deriveParentStatus(
  current: WorkItemStatus,
  childStatuses: readonly WorkItemStatus[],
): WorkItemStatus | null {
  if (childStatuses.length === 0) return null;

  let target: WorkItemStatus = current;
  if (childStatuses.every((status) => status === WorkItemStatus.DONE)) {
    target = WorkItemStatus.DONE;
  } else if (current === WorkItemStatus.DONE) {
    target = WorkItemStatus.IN_PROGRESS;
  } else if (
    current === WorkItemStatus.TODO &&
    childStatuses.some((status) => status !== WorkItemStatus.TODO)
  ) {
    target = WorkItemStatus.IN_PROGRESS;
  }
  return target === current ? null : target;
}

const isoDate = z.coerce.date();

export const createWorkItemSchema = z
  .object({
    type: z.nativeEnum(WorkItemType),
    title: z.string().trim().min(3, 'Le titre doit contenir au moins 3 caractères').max(255),
    status: z.nativeEnum(WorkItemStatus).optional(),
    parentId: uuidSchema.nullable().optional(),
    description: z.string().max(20000).nullable().optional(),
    technicalNotes: z.string().max(20000).nullable().optional(),
    priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
    storyPoints: z.number().int().min(0).max(100).nullable().optional(),
    /** Liste canonique. `assigneeId` reste accepté pour les anciens clients. */
    assigneeIds: z.array(uuidSchema).max(20).optional(),
    assigneeId: uuidSchema.nullable().optional(),
    sprintId: uuidSchema.nullable().optional(),
    labelIds: z.array(uuidSchema).max(20).optional(),
    tagIds: z.array(uuidSchema).max(20).optional(),
    startDate: isoDate.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
  })
  .refine((value) => !REQUIRES_PARENT.includes(value.type) || Boolean(value.parentId), {
    message: 'Une sous-tâche ou un bug doit être rattaché à une user story',
    path: ['parentId'],
  });
export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>;

export const acceptanceCriterionSchema = z.object({
  id: uuidSchema.optional(),
  content: z.string().trim().min(1, 'Le critère ne peut pas être vide').max(1000),
  isMet: z.boolean().default(false),
});
export type AcceptanceCriterionInput = z.infer<typeof acceptanceCriterionSchema>;

export const updateWorkItemSchema = z
  .object({
    title: z.string().trim().min(3).max(255).optional(),
    description: z.string().max(20000).nullable().optional(),
    technicalNotes: z.string().max(20000).nullable().optional(),
    status: z.nativeEnum(WorkItemStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    storyPoints: z.number().int().min(0).max(100).nullable().optional(),
    /** Permet de rattacher ou detacher une story/bug apres sa creation. */
    parentId: uuidSchema.nullable().optional(),
    /** Liste canonique. Une liste vide retire toutes les affectations. */
    assigneeIds: z.array(uuidSchema).max(20).optional(),
    assigneeId: uuidSchema.nullable().optional(),
    sprintId: uuidSchema.nullable().optional(),
    labelIds: z.array(uuidSchema).max(20).optional(),
    tagIds: z.array(uuidSchema).max(20).optional(),
    startDate: isoDate.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
    isBlocked: z.boolean().optional(),
    blockedReason: z.string().max(500).nullable().optional(),
    /** Remplace l'intégralité de la liste des critères d'acceptation. */
    acceptanceCriteria: z.array(acceptanceCriterionSchema).max(50).optional(),
    /**
     * C.1 · Confirme explicitement la propagation d'un changement de sprint
     * d'un Epic vers des descendants déjà affectés à un autre sprint — sans
     * quoi la requête est rejetée avec la liste des conflits à confirmer.
     */
    confirmSprintPropagation: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ à mettre à jour' });
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>;

/** Descendant d'un Epic déjà affecté à un autre sprint, renvoyé lors d'un conflit. */
export interface SprintPropagationConflict {
  id: string;
  key: string;
  title: string;
  type: WorkItemType;
  currentSprintId: string;
  currentSprintName: string;
}

/**
 * Déplacement unique pour le board ET le backlog.
 * - board : `status` change, `beforeId`/`afterId` donnent la position dans la colonne
 * - backlog : `parentId` change et/ou la position entre deux frères
 *
 * `beforeId` est le voisin du dessus, `afterId` celui du dessous. Les deux
 * absents = placement en fin de liste.
 */
export const moveWorkItemSchema = z.object({
  confirmSprintPropagation: z.boolean().optional(),
  /**
   * Colonne de destination sur le board. Elle fixe à la fois le statut (celui
   * de la colonne) et la colonne d'affichage — indispensable dès que plusieurs
   * colonnes partagent un même statut. Prioritaire sur `status`.
   */
  columnId: uuidSchema.optional(),
  status: z.nativeEnum(WorkItemStatus).optional(),
  parentId: uuidSchema.nullable().optional(),
  sprintId: uuidSchema.nullable().optional(),
  beforeId: uuidSchema.nullable().optional(),
  afterId: uuidSchema.nullable().optional(),
});
export type MoveWorkItemInput = z.infer<typeof moveWorkItemSchema>;

const booleanFlag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const WorkItemSortBy = {
  RANK: 'rank',
  KEY: 'key',
  TITLE: 'title',
  STATUS: 'status',
  PRIORITY: 'priority',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  DUE_DATE: 'dueDate',
} as const;
export type WorkItemSortBy = (typeof WorkItemSortBy)[keyof typeof WorkItemSortBy];

export const SortOrder = { ASC: 'asc', DESC: 'desc' } as const;
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

/** F.4 · Filtres avancés, partagés par le backlog et le board. */
export const workItemFiltersSchema = z.object({
  search: z.string().trim().max(160).optional(),
  assigneeId: uuidSchema.optional(),
  creatorId: uuidSchema.optional(),
  sprintId: uuidSchema.optional(),
  labelId: uuidSchema.optional(),
  tagId: uuidSchema.optional(),
  priority: z.nativeEnum(Priority).optional(),
  type: z.nativeEnum(WorkItemType).optional(),
  status: z.nativeEnum(WorkItemStatus).optional(),
  isBlocked: booleanFlag,
  /** Backlog : masquer les éléments terminés. */
  hideDone: booleanFlag,
  sortBy: z.nativeEnum(WorkItemSortBy).optional(),
  sortOrder: z.nativeEnum(SortOrder).optional(),
});
export type WorkItemFilters = z.infer<typeof workItemFiltersSchema>;

// --- Formes renvoyées par l'API ------------------------------------------

export interface LabelSummary {
  id: string;
  name: string;
  color: string;
}

export interface AcceptanceCriterionSummary {
  id: string;
  content: string;
  isMet: boolean;
  position: number;
}

export interface WorkItemSummary {
  id: string;
  /** Identifiant hiérarchique lisible : « VIS-1 » ou « VIS-1-2 ». */
  key: string;
  number: number;
  projectId: string;
  type: WorkItemType;
  title: string;
  status: WorkItemStatus;
  priority: Priority;
  storyPoints: number | null;
  rank: string;
  isBlocked: boolean;
  blockedReason: string | null;
  parentId: string | null;
  sprintId: string | null;
  /** Colonne personnalisée du board ; `null` = colonne par défaut de son statut. */
  boardColumnId: string | null;
  startDate: string | null;
  dueDate: string | null;
  /** Premier assigné conservé pour compatibilité avec les anciens écrans. */
  assignee: UserDirectoryEntry | null;
  assignees: UserDirectoryEntry[];
  reporter: UserDirectoryEntry;
  labels: LabelSummary[];
  tags: TagSummary[];
  childCount: number;
  doneChildCount: number;
  /** Somme des points des descendants (les epics n'estiment pas eux-mêmes). */
  rolledUpPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemDetail extends WorkItemSummary {
  description: string | null;
  technicalNotes: string | null;
  acceptanceCriteria: AcceptanceCriterionSummary[];
  children: WorkItemSummary[];
  parent: { id: string; key: string; title: string; type: WorkItemType } | null;
}

/** Nœud du backlog hiérarchique (Epic > Story > Sous-tâche). */
export interface BacklogNode extends WorkItemSummary {
  children: BacklogNode[];
}

/**
 * D.1 · Colonne du board, persistée par projet. Chaque colonne porte un statut
 * du workflow ; les colonnes par défaut (une par statut) ne se suppriment pas,
 * les colonnes personnalisées affinent un statut sans le remplacer.
 */
export interface BoardColumnConfig {
  id: string;
  name: string;
  status: WorkItemStatus;
  /** Colonne par défaut de son statut : non supprimable, statut figé. */
  isDefault: boolean;
  position: number;
  wipLimit: number | null;
  isVisible: boolean;
}

/** Colonne du board avec ses cartes : un ticket n'apparaît que dans une seule colonne. */
export interface BoardColumn extends BoardColumnConfig {
  items: WorkItemSummary[];
  count: number;
  points: number;
}

export const boardColumnInputSchema = z.object({
  /** Absent pour une nouvelle colonne personnalisée. */
  id: uuidSchema.optional(),
  name: z.string().trim().min(1, 'Le nom de la colonne est obligatoire').max(60),
  status: z.nativeEnum(WorkItemStatus),
  wipLimit: z.number().int().min(1).max(999).nullable().optional(),
  isVisible: z.boolean().default(true),
});
export type BoardColumnInput = z.infer<typeof boardColumnInputSchema>;

/**
 * Configuration complète des colonnes, dans l'ordre d'affichage. Comme les
 * étiquettes, elle se remplace en bloc : le client envoie l'état voulu. Une
 * colonne personnalisée absente de la liste est supprimée (ses tickets
 * retombent dans la colonne par défaut de leur statut).
 */
export const saveBoardColumnsSchema = z.object({
  columns: z.array(boardColumnInputSchema).min(1).max(30),
});
export type SaveBoardColumnsInput = z.infer<typeof saveBoardColumnsSchema>;

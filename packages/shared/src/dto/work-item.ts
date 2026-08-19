import { z } from 'zod';
import { Priority, WorkItemStatus, WorkItemType } from '../enums';
import { uuidSchema } from './common';
import type { UserDirectoryEntry } from './user';

/**
 * C.1 · Hiérarchie autorisée. Un EPIC est toujours racine ; une SUBTASK est
 * toujours rattachée. Cette table est la seule autorité — le service la
 * consulte avant d'accepter un `parentId`.
 */
export const ALLOWED_PARENT_TYPES: Record<WorkItemType, readonly WorkItemType[]> = {
  [WorkItemType.EPIC]: [],
  [WorkItemType.STORY]: [WorkItemType.EPIC],
  [WorkItemType.BUG]: [WorkItemType.EPIC],
  [WorkItemType.SUBTASK]: [WorkItemType.STORY, WorkItemType.BUG],
};

/** Types dont le parent est obligatoire. */
export const REQUIRES_PARENT: readonly WorkItemType[] = [WorkItemType.SUBTASK];

export function canBeChildOf(childType: WorkItemType, parentType: WorkItemType): boolean {
  return ALLOWED_PARENT_TYPES[childType].includes(parentType);
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
    assigneeId: uuidSchema.nullable().optional(),
    sprintId: uuidSchema.nullable().optional(),
    labelIds: z.array(uuidSchema).max(20).optional(),
    startDate: isoDate.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
  })
  .refine((value) => !REQUIRES_PARENT.includes(value.type) || Boolean(value.parentId), {
    message: 'Une sous-tâche doit être rattachée à une user story ou à un bug',
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
    assigneeId: uuidSchema.nullable().optional(),
    sprintId: uuidSchema.nullable().optional(),
    labelIds: z.array(uuidSchema).max(20).optional(),
    startDate: isoDate.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
    isBlocked: z.boolean().optional(),
    blockedReason: z.string().max(500).nullable().optional(),
    /** Remplace l'intégralité de la liste des critères d'acceptation. */
    acceptanceCriteria: z.array(acceptanceCriterionSchema).max(50).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ à mettre à jour' });
export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>;

/**
 * Déplacement unique pour le board ET le backlog.
 * - board : `status` change, `beforeId`/`afterId` donnent la position dans la colonne
 * - backlog : `parentId` change et/ou la position entre deux frères
 *
 * `beforeId` est le voisin du dessus, `afterId` celui du dessous. Les deux
 * absents = placement en fin de liste.
 */
export const moveWorkItemSchema = z.object({
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

/** F.4 · Filtres avancés, partagés par le backlog et le board. */
export const workItemFiltersSchema = z.object({
  search: z.string().trim().max(160).optional(),
  assigneeId: uuidSchema.optional(),
  sprintId: uuidSchema.optional(),
  labelId: uuidSchema.optional(),
  priority: z.nativeEnum(Priority).optional(),
  type: z.nativeEnum(WorkItemType).optional(),
  status: z.nativeEnum(WorkItemStatus).optional(),
  isBlocked: booleanFlag,
  /** Backlog : masquer les éléments terminés. */
  hideDone: booleanFlag,
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
  /** Identifiant lisible : « VIS-142 ». */
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
  startDate: string | null;
  dueDate: string | null;
  assignee: UserDirectoryEntry | null;
  labels: LabelSummary[];
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
  reporter: UserDirectoryEntry | null;
  acceptanceCriteria: AcceptanceCriterionSummary[];
  children: WorkItemSummary[];
  parent: { id: string; key: string; title: string; type: WorkItemType } | null;
}

/** Nœud du backlog hiérarchique (Epic > Story > Sous-tâche). */
export interface BacklogNode extends WorkItemSummary {
  children: BacklogNode[];
}

export interface BoardColumn {
  status: WorkItemStatus;
  items: WorkItemSummary[];
  count: number;
  points: number;
}

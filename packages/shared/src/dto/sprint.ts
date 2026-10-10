import { z } from 'zod';
import { RetroCategory, SprintStatus } from '../enums';
import { uuidSchema } from './common';
import type { WorkItemStatus } from '../enums';
import type { WorkItemSummary } from './work-item';

const isoDate = z.coerce.date();

/**
 * C.3 · Règles de dates d'un sprint, partagées par l'API (qui les applique) et
 * le formulaire (qui les signale avant l'envoi). Les dates de sprint sont des
 * jours calendaires, comparés en UTC à minuit.
 */
export const SprintDateIssue = {
  START_IN_PAST: 'SPRINT_START_IN_PAST',
  END_IN_PAST: 'SPRINT_END_IN_PAST',
  OVERLAP: 'SPRINT_DATES_OVERLAP',
} as const;
export type SprintDateIssue = (typeof SprintDateIssue)[keyof typeof SprintDateIssue];

/** Jour calendaire (minuit UTC) d'une date ou d'une chaîne « AAAA-MM-JJ ». */
export function startOfUtcDay(value: Date | string = new Date()): Date {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Deux périodes se chevauchent si elles partagent au moins un jour (bornes incluses). */
export function sprintPeriodsOverlap(
  a: { startDate: Date | string; endDate: Date | string },
  b: { startDate: Date | string; endDate: Date | string },
): boolean {
  return (
    startOfUtcDay(a.startDate) <= startOfUtcDay(b.endDate) &&
    startOfUtcDay(b.startDate) <= startOfUtcDay(a.endDate)
  );
}

const sprintFieldsSchema = z.object({
  name: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caracteres').max(120),
  goal: z.string().trim().max(2000).nullable().optional(),
  startDate: isoDate,
  endDate: isoDate,
});

export const createSprintSchema = sprintFieldsSchema.refine(
  (value) => value.startDate <= value.endDate,
  {
    message: 'La date de fin doit etre posterieure a la date de debut',
    path: ['endDate'],
  },
);
export type CreateSprintInput = z.infer<typeof createSprintSchema>;

export const updateSprintSchema = sprintFieldsSchema
  .partial()
  .extend({ status: z.nativeEnum(SprintStatus).optional() })
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ a mettre a jour' })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
    message: 'La date de fin doit etre posterieure a la date de debut',
    path: ['endDate'],
  });
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;

export const listSprintsQuerySchema = z.object({
  status: z.nativeEnum(SprintStatus).optional(),
});
export type ListSprintsQuery = z.infer<typeof listSprintsQuerySchema>;

export const retrospectiveItemInputSchema = z.object({
  id: uuidSchema.optional(),
  category: z.nativeEnum(RetroCategory),
  content: z.string().trim().min(1, 'Le contenu ne peut pas etre vide').max(2000),
  isDone: z.boolean().default(false),
});
export type RetrospectiveItemInput = z.infer<typeof retrospectiveItemInputSchema>;

export const updateRetrospectiveSchema = z.object({
  retroSummary: z.string().trim().max(5000).nullable().optional(),
  items: z.array(retrospectiveItemInputSchema).max(100),
});
export type UpdateRetrospectiveInput = z.infer<typeof updateRetrospectiveSchema>;

export const UnfinishedItemsAction = {
  MOVE_TO_SPRINT: 'MOVE_TO_SPRINT',
  BACKLOG: 'BACKLOG',
} as const;
export type UnfinishedItemsAction =
  (typeof UnfinishedItemsAction)[keyof typeof UnfinishedItemsAction];

export const closeSprintSchema = z
  .object({
    retroSummary: z.string().trim().max(5000).nullable().optional(),
    /** Choix explicite requis dès lors que le sprint contient des elements non termines. */
    unfinishedItemsAction: z.nativeEnum(UnfinishedItemsAction).optional(),
    /** Sprint destination ; requis si unfinishedItemsAction === MOVE_TO_SPRINT. */
    targetSprintId: uuidSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      value.unfinishedItemsAction !== UnfinishedItemsAction.MOVE_TO_SPRINT ||
      Boolean(value.targetSprintId),
    { message: 'Choisissez le sprint de destination', path: ['targetSprintId'] },
  );
export type CloseSprintInput = z.infer<typeof closeSprintSchema>;

export interface RetrospectiveItemSummary {
  id: string;
  category: RetroCategory;
  content: string;
  isDone: boolean;
  authorId: string | null;
  createdAt: string;
}

export interface SprintSummary {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  committedPoints: number | null;
  completedPoints: number | null;
  closedAt: string | null;
  retroSummary: string | null;
  totalItems: number;
  completedItems: number;
  liveCommittedPoints: number;
  liveCompletedPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface SprintDetail extends SprintSummary {
  items: WorkItemSummary[];
  retrospectiveItems: RetrospectiveItemSummary[];
}

export interface RoadmapEpic {
  id: string;
  key: string;
  title: string;
  status: WorkItemStatus;
  startDate: string | null;
  dueDate: string | null;
  childCount: number;
  doneChildCount: number;
  rolledUpPoints: number;
}

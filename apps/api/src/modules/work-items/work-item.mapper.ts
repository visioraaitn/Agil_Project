import { Prisma } from '@prisma/client';
import type {
  AcceptanceCriterionSummary,
  LabelSummary,
  Priority,
  WorkItemDetail,
  WorkItemStatus,
  WorkItemSummary,
  WorkItemType,
} from '@visiora/shared';

/** Colonnes nécessaires à la forme « résumé » d'un ticket. */
export const WORK_ITEM_SUMMARY_SELECT = {
  id: true,
  number: true,
  projectId: true,
  type: true,
  title: true,
  status: true,
  priority: true,
  storyPoints: true,
  rank: true,
  boardRank: true,
  isBlocked: true,
  blockedReason: true,
  parentId: true,
  sprintId: true,
  startDate: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
  labels: { select: { label: { select: { id: true, name: true, color: true } } } },
  project: { select: { key: true } },
} satisfies Prisma.WorkItemSelect;

export type WorkItemSummaryRow = Prisma.WorkItemGetPayload<{
  select: typeof WORK_ITEM_SUMMARY_SELECT;
}>;

export const WORK_ITEM_DETAIL_SELECT = {
  ...WORK_ITEM_SUMMARY_SELECT,
  description: true,
  technicalNotes: true,
  reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
  parent: { select: { id: true, number: true, title: true, type: true } },
  acceptanceCriteria: {
    where: {},
    select: { id: true, content: true, isMet: true, position: true },
    orderBy: { position: 'asc' },
  },
} satisfies Prisma.WorkItemSelect;

export type WorkItemDetailRow = Prisma.WorkItemGetPayload<{
  select: typeof WORK_ITEM_DETAIL_SELECT;
}>;

/** Agrégats calculés à partir des descendants, indexés par identifiant parent. */
export interface ChildAggregate {
  childCount: number;
  doneChildCount: number;
  rolledUpPoints: number;
}

const EMPTY_AGGREGATE: ChildAggregate = { childCount: 0, doneChildCount: 0, rolledUpPoints: 0 };

export function workItemKey(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

function toLabels(row: { labels: { label: LabelSummary }[] }): LabelSummary[] {
  return row.labels.map((entry) => entry.label);
}

export function toWorkItemSummary(
  row: WorkItemSummaryRow,
  aggregate: ChildAggregate = EMPTY_AGGREGATE,
): WorkItemSummary {
  return {
    id: row.id,
    key: workItemKey(row.project.key, row.number),
    number: row.number,
    projectId: row.projectId,
    type: row.type as WorkItemType,
    title: row.title,
    status: row.status as WorkItemStatus,
    priority: row.priority as Priority,
    storyPoints: row.storyPoints,
    rank: row.rank,
    isBlocked: row.isBlocked,
    blockedReason: row.blockedReason,
    parentId: row.parentId,
    sprintId: row.sprintId,
    startDate: row.startDate?.toISOString() ?? null,
    dueDate: row.dueDate?.toISOString() ?? null,
    assignee: row.assignee,
    labels: toLabels(row),
    childCount: aggregate.childCount,
    doneChildCount: aggregate.doneChildCount,
    /**
     * Un epic n'est pas estimé lui-même : sa charge est la somme de celle de
     * ses descendants. Pour une story sans sous-tâche, on retombe sur ses
     * propres points.
     */
    rolledUpPoints: aggregate.rolledUpPoints || (row.storyPoints ?? 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAcceptanceCriteria(
  rows: { id: string; content: string; isMet: boolean; position: number }[],
): AcceptanceCriterionSummary[] {
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    isMet: row.isMet,
    position: row.position,
  }));
}

export function toWorkItemDetail(
  row: WorkItemDetailRow,
  aggregate: ChildAggregate,
  children: WorkItemSummary[],
): WorkItemDetail {
  return {
    ...toWorkItemSummary(row, aggregate),
    description: row.description,
    technicalNotes: row.technicalNotes,
    reporter: row.reporter,
    acceptanceCriteria: toAcceptanceCriteria(row.acceptanceCriteria),
    children,
    parent: row.parent
      ? {
          id: row.parent.id,
          key: workItemKey(row.project.key, row.parent.number),
          title: row.parent.title,
          type: row.parent.type as WorkItemType,
        }
      : null,
  };
}

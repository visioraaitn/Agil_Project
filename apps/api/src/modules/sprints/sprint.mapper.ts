import { Prisma } from '@prisma/client';
import type {
  RetrospectiveItemSummary,
  SprintDetail,
  SprintStatus,
  SprintSummary,
} from '@visiora/shared';
import { WorkItemStatus } from '@visiora/shared';
import { WORK_ITEM_SUMMARY_SELECT, toWorkItemSummary } from '../work-items/work-item.mapper';

export const SPRINT_SUMMARY_SELECT = {
  id: true,
  projectId: true,
  name: true,
  goal: true,
  startDate: true,
  endDate: true,
  status: true,
  committedPoints: true,
  completedPoints: true,
  closedAt: true,
  retroSummary: true,
  createdAt: true,
  updatedAt: true,
  workItems: {
    where: { deletedAt: null },
    select: { id: true, status: true, storyPoints: true },
  },
} satisfies Prisma.SprintSelect;

export type SprintSummaryRow = Prisma.SprintGetPayload<{ select: typeof SPRINT_SUMMARY_SELECT }>;

export const SPRINT_DETAIL_SELECT = {
  ...SPRINT_SUMMARY_SELECT,
  workItems: {
    where: { deletedAt: null },
    select: WORK_ITEM_SUMMARY_SELECT,
    orderBy: [{ status: 'asc' }, { boardRank: 'asc' }],
  },
  retroItems: {
    select: {
      id: true,
      category: true,
      content: true,
      isDone: true,
      authorId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.SprintSelect;

export type SprintDetailRow = Prisma.SprintGetPayload<{ select: typeof SPRINT_DETAIL_SELECT }>;

type SprintWorkItemStats = {
  workItems: { status: string; storyPoints: number | null }[];
};

function stats(row: SprintWorkItemStats) {
  return {
    totalItems: row.workItems.length,
    completedItems: row.workItems.filter((item) => item.status === WorkItemStatus.DONE).length,
    liveCommittedPoints: row.workItems.reduce((total, item) => total + (item.storyPoints ?? 0), 0),
    liveCompletedPoints: row.workItems
      .filter((item) => item.status === WorkItemStatus.DONE)
      .reduce((total, item) => total + (item.storyPoints ?? 0), 0),
  };
}

export function toSprintSummary(row: SprintSummaryRow): SprintSummary {
  const computed = stats(row);
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    goal: row.goal,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    status: row.status as SprintStatus,
    committedPoints: row.committedPoints,
    completedPoints: row.completedPoints,
    closedAt: row.closedAt?.toISOString() ?? null,
    retroSummary: row.retroSummary,
    totalItems: computed.totalItems,
    completedItems: computed.completedItems,
    liveCommittedPoints: computed.liveCommittedPoints,
    liveCompletedPoints: computed.liveCompletedPoints,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toRetrospectiveItem(row: {
  id: string;
  category: string;
  content: string;
  isDone: boolean;
  authorId: string | null;
  createdAt: Date;
}): RetrospectiveItemSummary {
  return {
    id: row.id,
    category: row.category as RetrospectiveItemSummary['category'],
    content: row.content,
    isDone: row.isDone,
    authorId: row.authorId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSprintDetail(row: SprintDetailRow): SprintDetail {
  return {
    ...toSprintSummary(row),
    items: row.workItems.map((item) => toWorkItemSummary(item)),
    retrospectiveItems: row.retroItems.map(toRetrospectiveItem),
  };
}

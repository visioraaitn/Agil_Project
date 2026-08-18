import { z } from 'zod';
import type { Priority, SprintStatus, WorkItemStatus } from '../enums';
import type { WorkItemSummary } from './work-item';

export const globalSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});
export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;

export interface DashboardMetric {
  label: string;
  value: number;
  hint: string | null;
}

export interface StatusDistribution {
  status: WorkItemStatus;
  count: number;
  points: number;
}

export interface VelocityPoint {
  sprintId: string;
  sprintName: string;
  committedPoints: number;
  completedPoints: number;
}

export interface BurndownPoint {
  date: string;
  remainingPoints: number;
  completedPoints: number;
}

export interface ProjectDashboard {
  metrics: DashboardMetric[];
  statusDistribution: StatusDistribution[];
  velocity: VelocityPoint[];
  burndown: BurndownPoint[];
  blockedItems: WorkItemSummary[];
}

export type CalendarEventType = 'SPRINT' | 'MILESTONE' | 'WORK_ITEM';

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  start: string;
  end: string | null;
  status: SprintStatus | WorkItemStatus | null;
}

export type SearchResultType = 'PROJECT' | 'WORK_ITEM' | 'SPRINT' | 'PULL_REQUEST';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  url: string;
  projectKey: string | null;
  status: WorkItemStatus | SprintStatus | Priority | string | null;
}

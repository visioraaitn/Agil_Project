import type {
  BacklogNode,
  BoardColumn,
  CreateLabelInput,
  CreateWorkItemInput,
  LabelSummary,
  MoveWorkItemInput,
  UpdateWorkItemInput,
  WorkItemDetail,
  WorkItemFilters,
  WorkItemSummary,
} from '@visiora/shared';
import { api } from '@/lib/api-client';

/** Les filtres voyagent en query string ; les booléens sont sérialisés « true »/« false ». */
function toQuery(filters: WorkItemFilters): Record<string, string | undefined> {
  return {
    search: filters.search,
    assigneeId: filters.assigneeId,
    sprintId: filters.sprintId,
    labelId: filters.labelId,
    priority: filters.priority,
    type: filters.type,
    status: filters.status,
    isBlocked: filters.isBlocked === undefined ? undefined : String(filters.isBlocked),
    hideDone: filters.hideDone === undefined ? undefined : String(filters.hideDone),
  };
}

export const workItemsApi = {
  backlog: (projectRef: string, filters: WorkItemFilters = {}) =>
    api.get<BacklogNode[]>(`/projects/${projectRef}/backlog`, { query: toQuery(filters) }),

  board: (projectRef: string, filters: WorkItemFilters = {}) =>
    api.get<BoardColumn[]>(`/projects/${projectRef}/board`, { query: toQuery(filters) }),

  getOne: (projectRef: string, itemId: string) =>
    api.get<WorkItemDetail>(`/projects/${projectRef}/work-items/${itemId}`),

  create: (projectRef: string, input: CreateWorkItemInput) =>
    api.post<WorkItemDetail>(`/projects/${projectRef}/work-items`, input),

  update: (projectRef: string, itemId: string, input: UpdateWorkItemInput) =>
    api.patch<WorkItemDetail>(`/projects/${projectRef}/work-items/${itemId}`, input),

  /** Board : changement de colonne et de position. */
  move: (projectRef: string, itemId: string, input: MoveWorkItemInput) =>
    api.post<WorkItemSummary>(`/projects/${projectRef}/work-items/${itemId}/move`, input),

  /** Backlog : repriorisation entre frères. */
  reorder: (projectRef: string, itemId: string, input: MoveWorkItemInput) =>
    api.post<WorkItemSummary>(`/projects/${projectRef}/work-items/${itemId}/reorder`, input),

  remove: (projectRef: string, itemId: string) =>
    api.delete<void>(`/projects/${projectRef}/work-items/${itemId}`),
};

export const labelsApi = {
  list: (projectRef: string) => api.get<LabelSummary[]>(`/projects/${projectRef}/labels`),
  create: (projectRef: string, input: CreateLabelInput) =>
    api.post<LabelSummary>(`/projects/${projectRef}/labels`, input),
  remove: (projectRef: string, labelId: string) =>
    api.delete<void>(`/projects/${projectRef}/labels/${labelId}`),
};

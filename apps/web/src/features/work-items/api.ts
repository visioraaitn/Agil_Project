import type {
  BacklogNode,
  BoardColumn,
  CreateLabelInput,
  CreateTagInput,
  CreateWorkItemInput,
  LabelSummary,
  MoveWorkItemInput,
  TagSummary,
  UpdateLabelInput,
  UpdateTagInput,
  UpdateWorkItemInput,
  WorkItemDetail,
  WorkItemFilters,
  WorkItemImportSummary,
  WorkItemSummary,
} from '@visiora/shared';
import { api } from '@/lib/api-client';

/** Les filtres voyagent en query string ; les booléens sont sérialisés « true »/« false ». */
function toQuery(filters: WorkItemFilters): Record<string, string | undefined> {
  return {
    search: filters.search,
    assigneeId: filters.assigneeId,
    creatorId: filters.creatorId,
    sprintId: filters.sprintId,
    labelId: filters.labelId,
    tagId: filters.tagId,
    priority: filters.priority,
    type: filters.type,
    status: filters.status,
    isBlocked: filters.isBlocked === undefined ? undefined : String(filters.isBlocked),
    hideDone: filters.hideDone === undefined ? undefined : String(filters.hideDone),
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
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

  /** C.1 · Import de backlog depuis un fichier Excel/CSV — ajout uniquement. */
  import: (projectRef: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<WorkItemImportSummary>(`/projects/${projectRef}/work-items/import`, formData);
  },
};

export const labelsApi = {
  list: (projectRef: string) => api.get<LabelSummary[]>(`/projects/${projectRef}/labels`),
  create: (projectRef: string, input: CreateLabelInput) =>
    api.post<LabelSummary>(`/projects/${projectRef}/labels`, input),
  update: (projectRef: string, labelId: string, input: UpdateLabelInput) =>
    api.patch<LabelSummary>(`/projects/${projectRef}/labels/${labelId}`, input),
  remove: (projectRef: string, labelId: string) =>
    api.delete<void>(`/projects/${projectRef}/labels/${labelId}`),
};

export const tagsApi = {
  list: (projectRef: string) => api.get<TagSummary[]>(`/projects/${projectRef}/tags`),
  create: (projectRef: string, input: CreateTagInput) =>
    api.post<TagSummary>(`/projects/${projectRef}/tags`, input),
  update: (projectRef: string, tagId: string, input: UpdateTagInput) =>
    api.patch<TagSummary>(`/projects/${projectRef}/tags/${tagId}`, input),
  remove: (projectRef: string, tagId: string) =>
    api.delete<void>(`/projects/${projectRef}/tags/${tagId}`),
};

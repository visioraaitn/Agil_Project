import type {
  CloseSprintInput,
  CreateSprintInput,
  ListSprintsQuery,
  RoadmapEpic,
  SprintDetail,
  SprintSummary,
  UpdateRetrospectiveInput,
  UpdateSprintInput,
} from '@visiora/shared';
import { api } from '@/lib/api-client';

export const sprintsApi = {
  list: (projectRef: string, query: ListSprintsQuery = {}) =>
    api.get<SprintSummary[]>(`/projects/${projectRef}/sprints`, {
      query: { status: query.status },
    }),

  getOne: (projectRef: string, sprintId: string) =>
    api.get<SprintDetail>(`/projects/${projectRef}/sprints/${sprintId}`),

  create: (projectRef: string, input: CreateSprintInput) =>
    api.post<SprintDetail>(`/projects/${projectRef}/sprints`, input),

  update: (projectRef: string, sprintId: string, input: UpdateSprintInput) =>
    api.patch<SprintDetail>(`/projects/${projectRef}/sprints/${sprintId}`, input),

  close: (projectRef: string, sprintId: string, input: CloseSprintInput) =>
    api.post<SprintDetail>(`/projects/${projectRef}/sprints/${sprintId}/close`, input),

  updateRetrospective: (projectRef: string, sprintId: string, input: UpdateRetrospectiveInput) =>
    api.patch<SprintDetail>(`/projects/${projectRef}/sprints/${sprintId}/retrospective`, input),

  roadmap: (projectRef: string) => api.get<RoadmapEpic[]>(`/projects/${projectRef}/roadmap`),
};

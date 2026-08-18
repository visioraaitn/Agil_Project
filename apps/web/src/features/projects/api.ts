import type {
  AddProjectMemberInput,
  CreateProjectInput,
  ListProjectsQuery,
  Paginated,
  ProjectAccess,
  ProjectMemberSummary,
  ProjectSummary,
  UpdateProjectInput,
  UpdateProjectMemberInput,
} from '@visiora/shared';
import { api } from '@/lib/api-client';

export const projectsApi = {
  list: (query: Partial<ListProjectsQuery> = {}) =>
    api.get<Paginated<ProjectSummary>>('/projects', {
      query: {
        page: query.page,
        pageSize: query.pageSize,
        search: query.search,
        status: query.status,
        mine: query.mine === undefined ? undefined : String(query.mine),
      },
    }),

  /** `projectRef` accepte l'UUID ou la clé courte (« VIS »). */
  getOne: (projectRef: string) => api.get<ProjectSummary>(`/projects/${projectRef}`),

  getAccess: (projectRef: string) => api.get<ProjectAccess>(`/projects/${projectRef}/access`),

  create: (input: CreateProjectInput) => api.post<ProjectSummary>('/projects', input),

  update: (projectRef: string, input: UpdateProjectInput) =>
    api.patch<ProjectSummary>(`/projects/${projectRef}`, input),

  archive: (projectRef: string) => api.delete<void>(`/projects/${projectRef}`),

  listMembers: (projectRef: string) =>
    api.get<ProjectMemberSummary[]>(`/projects/${projectRef}/members`),

  addMember: (projectRef: string, input: AddProjectMemberInput) =>
    api.post<ProjectMemberSummary>(`/projects/${projectRef}/members`, input),

  updateMember: (projectRef: string, userId: string, input: UpdateProjectMemberInput) =>
    api.patch<ProjectMemberSummary>(`/projects/${projectRef}/members/${userId}`, input),

  removeMember: (projectRef: string, userId: string) =>
    api.delete<void>(`/projects/${projectRef}/members/${userId}`),
};

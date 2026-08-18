import type { CalendarEvent, ProjectDashboard, SearchResult } from '@visiora/shared';
import { api } from '@/lib/api-client';

export const reportsApi = {
  dashboard: (projectRef: string) =>
    api.get<ProjectDashboard>(`/projects/${projectRef}/dashboard`),

  calendar: (projectRef: string) =>
    api.get<CalendarEvent[]>(`/projects/${projectRef}/calendar`),

  search: (q: string) => api.get<SearchResult[]>('/search', { query: { q } }),
};

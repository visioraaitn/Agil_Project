import { useQuery } from '@tanstack/react-query';
import { reportsApi } from './api';

export const reportKeys = {
  dashboard: (projectRef: string) => ['projects', projectRef, 'dashboard'] as const,
  calendar: (projectRef: string) => ['projects', projectRef, 'calendar'] as const,
  search: (q: string) => ['search', q] as const,
};

export function useDashboard(projectRef: string) {
  return useQuery({
    queryKey: reportKeys.dashboard(projectRef),
    queryFn: () => reportsApi.dashboard(projectRef),
  });
}

export function useCalendar(projectRef: string) {
  return useQuery({
    queryKey: reportKeys.calendar(projectRef),
    queryFn: () => reportsApi.calendar(projectRef),
  });
}

export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: reportKeys.search(q),
    queryFn: () => reportsApi.search(q),
    enabled: q.trim().length >= 2,
  });
}

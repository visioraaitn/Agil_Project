import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Priority, WorkItemStatus, WorkItemType, type WorkItemFilters } from '@visiora/shared';

const FILTER_KEYS = [
  'search',
  'assigneeId',
  'sprintId',
  'labelId',
  'priority',
  'type',
  'status',
  'isBlocked',
  'hideDone',
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];

const priorities = new Set<string>(Object.values(Priority));
const types = new Set<string>(Object.values(WorkItemType));
const statuses = new Set<string>(Object.values(WorkItemStatus));
const DEFAULT_FILTERS: WorkItemFilters = {};

/** Phase 7: conserve les filtres dans l'URL pour partager/reprendre une vue. */
export function useUrlWorkItemFilters(defaults: WorkItemFilters = DEFAULT_FILTERS) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => ({ ...defaults, ...readFilters(searchParams) }),
    [defaults, searchParams],
  );

  const setFilters = useCallback(
    (next: WorkItemFilters) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);

          for (const key of FILTER_KEYS) {
            params.delete(key);
          }

          for (const [key, value] of Object.entries(next) as [FilterKey, unknown][]) {
            if (value === undefined || value === null || value === '') continue;
            params.set(key, String(value));
          }

          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return [filters, setFilters] as const;
}

function readFilters(params: URLSearchParams): WorkItemFilters {
  return compact({
    search: readString(params, 'search'),
    assigneeId: readString(params, 'assigneeId'),
    sprintId: readString(params, 'sprintId'),
    labelId: readString(params, 'labelId'),
    priority: readEnum(params, 'priority', priorities) as Priority | undefined,
    type: readEnum(params, 'type', types) as WorkItemType | undefined,
    status: readEnum(params, 'status', statuses) as WorkItemStatus | undefined,
    isBlocked: readBoolean(params, 'isBlocked'),
    hideDone: readBoolean(params, 'hideDone'),
  });
}

function readString(params: URLSearchParams, key: FilterKey): string | undefined {
  const value = params.get(key)?.trim();
  return value || undefined;
}

function readEnum(params: URLSearchParams, key: FilterKey, allowed: Set<string>): string | undefined {
  const value = params.get(key);
  return value && allowed.has(value) ? value : undefined;
}

function readBoolean(params: URLSearchParams, key: FilterKey): boolean | undefined {
  const value = params.get(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function compact(filters: WorkItemFilters): WorkItemFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  ) as WorkItemFilters;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BoardColumn,
  CreateLabelInput,
  CreateWorkItemInput,
  MoveWorkItemInput,
  UpdateWorkItemInput,
  WorkItemFilters,
} from '@visiora/shared';
import { labelsApi, workItemsApi } from './api';

export const workItemKeys = {
  backlog: (projectRef: string, filters: WorkItemFilters) =>
    ['projects', projectRef, 'backlog', filters] as const,
  board: (projectRef: string, filters: WorkItemFilters) =>
    ['projects', projectRef, 'board', filters] as const,
  detail: (projectRef: string, itemId: string) =>
    ['projects', projectRef, 'work-items', itemId] as const,
  labels: (projectRef: string) => ['projects', projectRef, 'labels'] as const,
};

export function useBacklog(projectRef: string, filters: WorkItemFilters) {
  return useQuery({
    queryKey: workItemKeys.backlog(projectRef, filters),
    queryFn: () => workItemsApi.backlog(projectRef, filters),
  });
}

export function useBoard(projectRef: string, filters: WorkItemFilters) {
  return useQuery({
    queryKey: workItemKeys.board(projectRef, filters),
    queryFn: () => workItemsApi.board(projectRef, filters),
  });
}

export function useWorkItem(projectRef: string, itemId: string | null) {
  return useQuery({
    queryKey: workItemKeys.detail(projectRef, itemId ?? ''),
    queryFn: () => workItemsApi.getOne(projectRef, itemId as string),
    enabled: Boolean(itemId),
  });
}

export function useLabels(projectRef: string) {
  return useQuery({
    queryKey: workItemKeys.labels(projectRef),
    queryFn: () => labelsApi.list(projectRef),
  });
}

/** Invalide tout ce qui dépend des tickets du projet (backlog, board, détails). */
function useInvalidateWorkItems(projectRef: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['projects', projectRef] });
}

export function useCreateWorkItem(projectRef: string) {
  const invalidate = useInvalidateWorkItems(projectRef);
  return useMutation({
    mutationFn: (input: CreateWorkItemInput) => workItemsApi.create(projectRef, input),
    onSuccess: invalidate,
  });
}

export function useUpdateWorkItem(projectRef: string) {
  const invalidate = useInvalidateWorkItems(projectRef);
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateWorkItemInput }) =>
      workItemsApi.update(projectRef, itemId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteWorkItem(projectRef: string) {
  const invalidate = useInvalidateWorkItems(projectRef);
  return useMutation({
    mutationFn: (itemId: string) => workItemsApi.remove(projectRef, itemId),
    onSuccess: invalidate,
  });
}

/**
 * Déplacement d'une carte sur le board.
 *
 * Le cache est mis à jour avant la réponse serveur : sans cela, la carte
 * reviendrait visiblement à sa place le temps de l'aller-retour. En cas
 * d'échec, l'état précédent est restauré.
 */
export function useMoveWorkItem(projectRef: string, filters: WorkItemFilters) {
  const queryClient = useQueryClient();
  const key = workItemKeys.board(projectRef, filters);

  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: MoveWorkItemInput }) =>
      workItemsApi.move(projectRef, itemId, input),

    onMutate: async ({ itemId, input }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardColumn[]>(key);

      if (previous && input.status) {
        queryClient.setQueryData<BoardColumn[]>(key, moveCardInCache(previous, itemId, input));
      }

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: ['projects', projectRef] }),
  });
}

/** Recompose les colonnes en déplaçant une carte, pour l'affichage optimiste. */
function moveCardInCache(
  columns: BoardColumn[],
  itemId: string,
  input: MoveWorkItemInput,
): BoardColumn[] {
  const card = columns.flatMap((column) => column.items).find((item) => item.id === itemId);
  if (!card || !input.status) return columns;

  const moved = { ...card, status: input.status };

  return columns.map((column) => {
    const withoutCard = column.items.filter((item) => item.id !== itemId);

    if (column.status !== input.status) {
      return recount({ ...column, items: withoutCard });
    }

    const anchorId = input.afterId ?? input.beforeId;
    const anchorIndex = anchorId ? withoutCard.findIndex((item) => item.id === anchorId) : -1;
    const insertAt =
      anchorIndex === -1
        ? withoutCard.length
        : input.afterId
          ? anchorIndex
          : anchorIndex + 1;

    const items = [...withoutCard];
    items.splice(insertAt, 0, moved);
    return recount({ ...column, items });
  });
}

function recount(column: BoardColumn): BoardColumn {
  return {
    ...column,
    count: column.items.length,
    points: column.items.reduce((total, item) => total + (item.storyPoints ?? 0), 0),
  };
}

export function useReorderBacklog(projectRef: string) {
  const invalidate = useInvalidateWorkItems(projectRef);
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: MoveWorkItemInput }) =>
      workItemsApi.reorder(projectRef, itemId, input),
    onSuccess: invalidate,
  });
}

export function useCreateLabel(projectRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLabelInput) => labelsApi.create(projectRef, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workItemKeys.labels(projectRef) }),
  });
}

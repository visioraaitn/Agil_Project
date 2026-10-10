import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BoardColumn,
  BoardColumnConfig,
  SaveBoardColumnsInput,
  CreateLabelInput,
  CreateTagInput,
  CreateWorkItemInput,
  MoveWorkItemInput,
  UpdateLabelInput,
  UpdateTagInput,
  UpdateWorkItemInput,
  WorkItemFilters,
} from '@visiora/shared';
import { labelsApi, tagsApi, workItemsApi } from './api';

export const workItemKeys = {
  backlog: (projectRef: string, filters: WorkItemFilters) =>
    ['projects', projectRef, 'backlog', filters] as const,
  board: (projectRef: string, filters: WorkItemFilters) =>
    ['projects', projectRef, 'board', filters] as const,
  detail: (projectRef: string, itemId: string) =>
    ['projects', projectRef, 'work-items', itemId] as const,
  labels: (projectRef: string) => ['projects', projectRef, 'labels'] as const,
  tags: (projectRef: string) => ['projects', projectRef, 'tags'] as const,
};

export function useBacklog(projectRef: string, filters: WorkItemFilters) {
  return useQuery({
    queryKey: workItemKeys.backlog(projectRef, filters),
    queryFn: () => workItemsApi.backlog(projectRef, filters),
  });
}

export function useBoard(projectRef: string, filters: WorkItemFilters, enabled = true) {
  return useQuery({
    queryKey: workItemKeys.board(projectRef, filters),
    queryFn: () => workItemsApi.board(projectRef, filters),
    enabled,
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

export function useTags(projectRef: string) {
  return useQuery({
    queryKey: workItemKeys.tags(projectRef),
    queryFn: () => tagsApi.list(projectRef),
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

      if (previous && input.columnId) {
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

/**
 * Recompose les colonnes en déplaçant une carte, pour l'affichage optimiste.
 * La cible est désignée par son identifiant de colonne, jamais par son statut :
 * plusieurs colonnes peuvent partager un statut, la carte n'en rejoint qu'une.
 */
function moveCardInCache(
  columns: BoardColumn[],
  itemId: string,
  input: MoveWorkItemInput,
): BoardColumn[] {
  const card = columns.flatMap((column) => column.items).find((item) => item.id === itemId);
  const target = columns.find((column) => column.id === input.columnId);
  if (!card || !target) return columns;

  const moved = {
    ...card,
    status: target.status,
    boardColumnId: target.isDefault ? null : target.id,
  };

  return columns.map((column) => {
    const withoutCard = column.items.filter((item) => item.id !== itemId);

    if (column.id !== target.id) {
      return recount({ ...column, items: withoutCard });
    }

    const anchorId = input.afterId ?? input.beforeId;
    const anchorIndex = anchorId ? withoutCard.findIndex((item) => item.id === anchorId) : -1;
    const insertAt =
      anchorIndex === -1 ? withoutCard.length : input.afterId ? anchorIndex : anchorIndex + 1;

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

/**
 * D.1 · Enregistre la configuration des colonnes (ordre, noms, WIP, visibilité,
 * ajouts). L'ordre est appliqué tout de suite à tous les boards en cache du
 * projet, pour que le glisser-déposer d'une colonne ne « saute » pas en
 * attendant la réponse ; `onError` restaure l'état précédent.
 */
export function useSaveBoardColumns(projectRef: string) {
  const queryClient = useQueryClient();
  const boardsKey = ['projects', projectRef, 'board'];

  return useMutation({
    mutationFn: (input: SaveBoardColumnsInput) => workItemsApi.saveBoardColumns(projectRef, input),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: boardsKey });
      const previous = queryClient.getQueriesData<BoardColumn[]>({ queryKey: boardsKey });
      const order = input.columns.map((column) => column.id);

      queryClient.setQueriesData<BoardColumn[]>({ queryKey: boardsKey }, (columns) => {
        if (!columns) return columns;
        // Seules les colonnes existantes se réordonnent ici ; les ajouts arrivent avec le serveur.
        return [...columns]
          .filter((column) => order.includes(column.id))
          .sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id))
          .map((column, position) => {
            const sent = input.columns.find((entry) => entry.id === column.id);
            return sent
              ? {
                  ...column,
                  position,
                  name: sent.name,
                  wipLimit: sent.wipLimit ?? null,
                  isVisible: sent.isVisible,
                }
              : column;
          });
      });

      return { previous };
    },

    onError: (_error, _input, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: ['projects', projectRef] }),
  });
}

/** Configuration complète à renvoyer au serveur, à partir des colonnes affichées. */
export function toBoardColumnsInput(columns: BoardColumnConfig[]): SaveBoardColumnsInput {
  return {
    columns: columns.map((column) => ({
      id: column.id,
      name: column.name,
      status: column.status,
      wipLimit: column.wipLimit,
      isVisible: column.isVisible,
    })),
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

export function useImportWorkItems(projectRef: string) {
  const invalidate = useInvalidateWorkItems(projectRef);
  return useMutation({
    mutationFn: (file: File) => workItemsApi.import(projectRef, file),
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

export function useUpdateLabel(projectRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId, input }: { labelId: string; input: UpdateLabelInput }) =>
      labelsApi.update(projectRef, labelId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workItemKeys.labels(projectRef) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectRef] });
    },
  });
}

export function useDeleteLabel(projectRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => labelsApi.remove(projectRef, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workItemKeys.labels(projectRef) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectRef] });
    },
  });
}

export function useCreateTag(projectRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTagInput) => tagsApi.create(projectRef, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workItemKeys.tags(projectRef) }),
  });
}

export function useUpdateTag(projectRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, input }: { tagId: string; input: UpdateTagInput }) =>
      tagsApi.update(projectRef, tagId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workItemKeys.tags(projectRef) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectRef] });
    },
  });
}

export function useDeleteTag(projectRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => tagsApi.remove(projectRef, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workItemKeys.tags(projectRef) });
      queryClient.invalidateQueries({ queryKey: ['projects', projectRef] });
    },
  });
}

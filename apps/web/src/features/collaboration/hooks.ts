import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { CreateCommentInput } from '@visiora/shared';
import { getAccessToken } from '@/lib/api-client';
import { collaborationApi } from './api';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export const collaborationKeys = {
  comments: (projectRef: string, itemId: string) =>
    ['projects', projectRef, 'work-items', itemId, 'comments'] as const,
  activity: (projectRef: string, itemId: string) =>
    ['projects', projectRef, 'work-items', itemId, 'activity'] as const,
  notifications: ['notifications'] as const,
  attachments: (projectRef: string, itemId: string) =>
    ['projects', projectRef, 'work-items', itemId, 'attachments'] as const,
};

export function useComments(projectRef: string, itemId: string | null) {
  return useQuery({
    queryKey: collaborationKeys.comments(projectRef, itemId ?? ''),
    queryFn: () => collaborationApi.comments(projectRef, itemId as string),
    enabled: Boolean(itemId),
  });
}

export function useActivity(projectRef: string, itemId: string | null) {
  return useQuery({
    queryKey: collaborationKeys.activity(projectRef, itemId ?? ''),
    queryFn: () => collaborationApi.activity(projectRef, itemId as string),
    enabled: Boolean(itemId),
  });
}

export function useCreateComment(projectRef: string, itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) => collaborationApi.createComment(projectRef, itemId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: collaborationKeys.comments(projectRef, itemId) }),
        queryClient.invalidateQueries({ queryKey: collaborationKeys.activity(projectRef, itemId) }),
      ]);
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: collaborationKeys.notifications,
    queryFn: collaborationApi.notifications,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => collaborationApi.markNotificationRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collaborationKeys.notifications }),
  });
}

export function useRealtimeNotifications(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getAccessToken();
    if (!enabled || !token) return;

    const source = new EventSource(
      `${BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`,
      { withCredentials: true },
    );

    source.addEventListener('notification', () => {
      void queryClient.invalidateQueries({ queryKey: collaborationKeys.notifications });
    });

    return () => source.close();
  }, [enabled, queryClient]);
}

export function useAttachments(projectRef: string, itemId: string) {
  return useQuery({
    queryKey: collaborationKeys.attachments(projectRef, itemId),
    queryFn: () => collaborationApi.attachments(projectRef, itemId),
  });
}

export function useUploadAttachment(projectRef: string, itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => collaborationApi.uploadAttachment(projectRef, itemId, file),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: collaborationKeys.attachments(projectRef, itemId),
      }),
  });
}

export function useDeleteAttachment(projectRef: string, itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      collaborationApi.deleteAttachment(projectRef, itemId, attachmentId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: collaborationKeys.attachments(projectRef, itemId),
      }),
  });
}

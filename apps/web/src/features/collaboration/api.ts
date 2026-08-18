import type {
  ActivitySummary,
  AttachmentSummary,
  CommentSummary,
  CreateCommentInput,
  NotificationSummary,
} from '@visiora/shared';
import { api, getAccessToken } from '@/lib/api-client';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export const collaborationApi = {
  comments: (projectRef: string, itemId: string) =>
    api.get<CommentSummary[]>(`/projects/${projectRef}/work-items/${itemId}/comments`),

  createComment: (projectRef: string, itemId: string, input: CreateCommentInput) =>
    api.post<CommentSummary>(`/projects/${projectRef}/work-items/${itemId}/comments`, input),

  activity: (projectRef: string, itemId: string) =>
    api.get<ActivitySummary[]>(`/projects/${projectRef}/work-items/${itemId}/activity`),

  notifications: () => api.get<NotificationSummary[]>('/notifications'),

  markNotificationRead: (notificationId: string) =>
    api.patch<NotificationSummary>(`/notifications/${notificationId}/read`),

  attachments: (projectRef: string, itemId: string) =>
    api.get<AttachmentSummary[]>(`/projects/${projectRef}/work-items/${itemId}/attachments`),

  uploadAttachment: (projectRef: string, itemId: string, file: File) => {
    const form = new FormData();
    form.set('file', file);
    return api.post<AttachmentSummary>(
      `/projects/${projectRef}/work-items/${itemId}/attachments`,
      form,
    );
  },

  deleteAttachment: (projectRef: string, itemId: string, attachmentId: string) =>
    api.delete<void>(`/projects/${projectRef}/work-items/${itemId}/attachments/${attachmentId}`),

  downloadAttachment: async (projectRef: string, itemId: string, attachmentId: string) => {
    const token = getAccessToken();
    const response = await fetch(
      `${BASE_URL}/projects/${projectRef}/work-items/${itemId}/attachments/${attachmentId}/download`,
      {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );
    if (!response.ok) throw new Error('Telechargement impossible');
    return response.blob();
  },
};

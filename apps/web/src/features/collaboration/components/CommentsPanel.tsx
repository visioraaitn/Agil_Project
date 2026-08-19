import { useMemo, useState } from 'react';
import type { UserDirectoryEntry } from '@visiora/shared';
import { Avatar } from '@/components/common/Avatar';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { MarkdownViewer } from '@/components/common/MarkdownViewer';
import { InlineError, LoadingState } from '@/components/common/StateMessage';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { collaborationApi } from '../api';
import { useActivity, useComments, useCreateComment } from '../hooks';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export function CommentsPanel({
  projectRef,
  itemId,
  members,
  canComment,
}: {
  projectRef: string;
  itemId: string;
  members: UserDirectoryEntry[];
  canComment: boolean;
}) {
  const { data: comments, isLoading } = useComments(projectRef, itemId);
  const { data: activity } = useActivity(projectRef, itemId);
  const createComment = useCreateComment(projectRef, itemId);
  const [body, setBody] = useState('');
  const [mentionedUserId, setMentionedUserId] = useState('');

  const mentionedUserIds = useMemo(
    () => (mentionedUserId ? [mentionedUserId] : []),
    [mentionedUserId],
  );

  const submit = async () => {
    await createComment.mutateAsync({ body, mentionedUserIds });
    setBody('');
    setMentionedUserId('');
  };

  const uploadImage = async (file: File): Promise<string> => {
    const uploaded = await collaborationApi.uploadAttachment(projectRef, itemId, file);
    return `${API_BASE}/projects/${projectRef}/work-items/${itemId}/attachments/${uploaded.id}/download`;
  };

  return (
    <section className="border-border-subtle border-t pt-3">
      <h3 className="text-ink-700 mb-2 text-sm font-semibold">Commentaires</h3>
      {canComment && (
        <div className="mb-3 flex flex-col gap-2">
          <MarkdownEditor
            value={body}
            onChange={setBody}
            minHeight="90px"
            onUploadImage={uploadImage}
            placeholder="Ajouter un commentaire en Markdown ou coller une capture (Ctrl + V)..."
          />
          <div className="flex gap-2 items-center">
            <Select
              value={mentionedUserId}
              onChange={(event) => setMentionedUserId(event.target.value)}
              aria-label="Mentionner"
              className="max-w-56 h-8 text-xs"
            >
              <option value="">Sans mention</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  @{member.name}
                </option>
              ))}
            </Select>
            <Button
              className="ml-auto h-8 text-xs"
              variant="primary"
              onClick={submit}
              loading={createComment.isPending}
              disabled={body.trim().length === 0}
            >
              Commenter
            </Button>
          </div>
          <InlineError error={createComment.error} />
        </div>
      )}

      {isLoading ? (
        <LoadingState label="Chargement des commentaires..." />
      ) : (comments ?? []).length === 0 ? (
        <p className="text-ink-400 text-sm">Aucun commentaire.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments?.map((comment) => (
            <li key={comment.id} className="border-border-subtle rounded border px-3 py-2 bg-surface">
              <div className="mb-1.5 flex items-center gap-2">
                <Avatar name={comment.author.name} avatarUrl={comment.author.avatarUrl} />
                <span className="text-ink-900 text-sm font-semibold">{comment.author.name}</span>
                <span className="text-ink-400 text-xs">{formatDate(comment.createdAt)}</span>
              </div>
              <MarkdownViewer content={comment.body} />
            </li>
          ))}
        </ul>
      )}

      {(activity ?? []).length > 0 && (
        <div className="mt-4">
          <h3 className="text-ink-700 mb-1 text-sm font-semibold">Activité récente</h3>
          <ul className="text-ink-500 flex flex-col gap-1 text-sm">
            {activity?.slice(0, 8).map((entry) => (
              <li key={entry.id}>
                {entry.actor?.name ?? 'Système'} · {entry.action} · {formatDate(entry.createdAt)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

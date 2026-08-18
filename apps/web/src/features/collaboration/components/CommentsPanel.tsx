import { useMemo, useState } from 'react';
import type { UserDirectoryEntry } from '@visiora/shared';
import { Avatar } from '@/components/common/Avatar';
import { InlineError, LoadingState } from '@/components/common/StateMessage';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/input';
import { useActivity, useComments, useCreateComment } from '../hooks';

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

  return (
    <section className="border-border-subtle border-t pt-3">
      <h3 className="text-ink-700 mb-2 text-sm font-semibold">Commentaires</h3>
      {canComment && (
        <div className="mb-3 flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="Ajouter un commentaire"
          />
          <div className="flex gap-2">
            <Select
              value={mentionedUserId}
              onChange={(event) => setMentionedUserId(event.target.value)}
              aria-label="Mentionner"
              className="max-w-56"
            >
              <option value="">Sans mention</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  @{member.name}
                </option>
              ))}
            </Select>
            <Button
              className="ml-auto"
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
            <li key={comment.id} className="border-border-subtle rounded border px-2 py-2">
              <div className="mb-1 flex items-center gap-2">
                <Avatar name={comment.author.name} avatarUrl={comment.author.avatarUrl} />
                <span className="text-ink-900 text-sm font-semibold">{comment.author.name}</span>
                <span className="text-ink-400 text-xs">{formatDate(comment.createdAt)}</span>
              </div>
              <p className="text-ink-700 whitespace-pre-wrap text-base">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      {(activity ?? []).length > 0 && (
        <div className="mt-4">
          <h3 className="text-ink-700 mb-1 text-sm font-semibold">Activite recente</h3>
          <ul className="text-ink-500 flex flex-col gap-1 text-sm">
            {activity?.slice(0, 8).map((entry) => (
              <li key={entry.id}>
                {entry.actor?.name ?? 'Systeme'} · {entry.action} · {formatDate(entry.createdAt)}
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

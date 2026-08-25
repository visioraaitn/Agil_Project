import type { UserDirectoryEntry } from '@visiora/shared';
import { Avatar } from './Avatar';

export function AvatarStack({ users, limit = 3 }: { users: UserDirectoryEntry[]; limit?: number }) {
  const visible = users.slice(0, limit);
  const hidden = users.length - visible.length;

  if (users.length === 0) {
    return (
      <span className="border-border-strong text-ink-400 flex size-6 items-center justify-center rounded-full border border-dashed text-xs">
        ?
      </span>
    );
  }

  return (
    <span
      className="flex items-center -space-x-1.5"
      title={users.map((user) => user.name).join(', ')}
    >
      {visible.map((user) => (
        <Avatar
          key={user.id}
          name={user.name}
          avatarUrl={user.avatarUrl}
          className="border-surface border"
        />
      ))}
      {hidden > 0 && (
        <span className="bg-surface-muted border-surface text-ink-600 flex size-6 items-center justify-center rounded-full border text-xs font-semibold">
          +{hidden}
        </span>
      )}
    </span>
  );
}

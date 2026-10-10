import { Plus } from 'lucide-react';
import type { UserDirectoryEntry } from '@visiora/shared';
import { Avatar } from './Avatar';

export function AvatarStack({ users, limit = 3 }: { users: UserDirectoryEntry[]; limit?: number }) {
  const visible = users.slice(0, limit);
  const hidden = users.length - visible.length;

  if (users.length === 0) {
    return (
      <span
        className="border-border-strong text-ink-400 flex size-6 items-center justify-center rounded-full border border-dashed"
        title="Non assigné"
      >
        <Plus className="size-3" strokeWidth={2} />
      </span>
    );
  }

  return (
    <span
      className="flex items-center -space-x-1"
      title={users.map((user) => user.name).join(', ')}
    >
      {visible.map((user) => (
        <Avatar
          key={user.id}
          name={user.name}
          avatarUrl={user.avatarUrl}
          className="ring-surface ring-2"
        />
      ))}
      {hidden > 0 && (
        <span className="bg-surface-sunken ring-surface text-ink-600 flex size-6 ring-2 items-center justify-center rounded-full text-[10px] font-semibold">
          +{hidden}
        </span>
      )}
    </span>
  );
}

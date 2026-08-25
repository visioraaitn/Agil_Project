import type { UserDirectoryEntry } from '@visiora/shared';
import { Avatar } from '@/components/common/Avatar';
import { cn } from '@/lib/utils';

interface AssigneeSelectorProps {
  members: UserDirectoryEntry[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
}

/** Sélecteur compact et accessible autorisant plusieurs membres sur un ticket. */
export function AssigneeSelector({
  members,
  selectedIds,
  onChange,
  disabled = false,
  className,
}: AssigneeSelectorProps) {
  const toggle = (userId: string, checked: boolean) => {
    onChange(
      checked ? [...new Set([...selectedIds, userId])] : selectedIds.filter((id) => id !== userId),
    );
  };

  return (
    <fieldset
      disabled={disabled}
      className={cn(
        'border-border-strong bg-surface scrollbar-thin max-h-32 overflow-y-auto rounded border p-1.5',
        disabled && 'bg-surface-sunken opacity-70',
        className,
      )}
    >
      {members.length === 0 ? (
        <p className="text-ink-400 px-1 py-1 text-sm">Aucun membre dans le projet.</p>
      ) : (
        members.map((member) => (
          <label
            key={member.id}
            className="hover:bg-surface-muted flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(member.id)}
              onChange={(event) => toggle(member.id, event.target.checked)}
              className="size-3.5"
            />
            <Avatar name={member.name} avatarUrl={member.avatarUrl} />
            <span className="text-ink-800 min-w-0 truncate">{member.name}</span>
          </label>
        ))
      )}
    </fieldset>
  );
}

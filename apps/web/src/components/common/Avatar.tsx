import { cn, initials } from '@/lib/utils';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function Avatar({ name, avatarUrl, size = 'sm', className }: AvatarProps) {
  const dimension = size === 'sm' ? 'size-6 text-xs' : 'size-8 text-sm';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn('shrink-0 rounded-full object-cover', dimension, className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        'bg-accent-600 flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        dimension,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

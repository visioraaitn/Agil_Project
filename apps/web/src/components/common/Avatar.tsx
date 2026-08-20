import { cn, initials } from '@/lib/utils';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/$/,
  '',
);

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function Avatar({ name, avatarUrl, size = 'sm', className }: AvatarProps) {
  const dimension = size === 'sm' ? 'size-6 text-xs' : 'size-8 text-sm';

  if (avatarUrl) {
    const source = avatarUrl.startsWith('/') ? `${API_BASE_URL}${avatarUrl}` : avatarUrl;
    return (
      <img
        src={source}
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

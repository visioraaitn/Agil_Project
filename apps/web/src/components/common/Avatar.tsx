import { avatarColor, cn, initials } from '@/lib/utils';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/$/,
  '',
);

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

const DIMENSIONS: Record<AvatarSize, string> = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-9 text-sm',
};

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ name, avatarUrl, size = 'sm', className }: AvatarProps) {
  const dimension = DIMENSIONS[size];

  if (avatarUrl) {
    const source = avatarUrl.startsWith('/') ? `${API_BASE_URL}${avatarUrl}` : avatarUrl;
    return (
      <img
        src={source}
        alt=""
        title={name}
        className={cn('shrink-0 rounded-full object-cover', dimension, className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        dimension,
        className,
      )}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  );
}

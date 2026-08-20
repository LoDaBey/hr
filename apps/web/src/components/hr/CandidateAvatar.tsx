'use client';

import { Avatar } from '@mantine/core';
import { palette } from '@/theme';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function CandidateAvatar({
  name,
  size = 32,
}: {
  name: string;
  size?: number;
}) {
  return (
    <Avatar
      size={size}
      radius="md"
      color="accent"
      variant="filled"
      aria-hidden
      styles={{
        placeholder: {
          backgroundColor: `${palette.accent}18`,
          color: palette.accent,
          fontWeight: 600,
          fontSize: size * 0.35,
        },
      }}
    >
      {initials(name)}
    </Avatar>
  );
}

import Image from 'next/image';
import { Box } from '@mantine/core';

const LOGO_WIDTH = 400;
const LOGO_HEIGHT = 78;
/** Left mark is roughly square within the horizontal lockup. */
const MARK_RATIO = LOGO_HEIGHT / LOGO_WIDTH;

export function BrandLogo({
  height = 32,
  priority = false,
  markOnly = false,
}: {
  height?: number;
  priority?: boolean;
  /** Crop to the circular mark for narrow places (collapsed sidebar). */
  markOnly?: boolean;
}) {
  const width = Math.round((LOGO_WIDTH / LOGO_HEIGHT) * height);

  if (markOnly) {
    const cropWidth = Math.round(height / MARK_RATIO);
    return (
      <Box
        style={{
          width: height,
          height,
          overflow: 'hidden',
          flexShrink: 0,
        }}
        aria-hidden={false}
      >
        <Image
          src="/logo.png"
          alt="Alpha"
          width={cropWidth}
          height={height}
          priority={priority}
          style={{
            display: 'block',
            height,
            width: 'auto',
            maxWidth: 'none',
          }}
        />
      </Box>
    );
  }

  return (
    <Image
      src="/logo.png"
      alt="Alpha"
      width={width}
      height={height}
      priority={priority}
      style={{ display: 'block', height, width: 'auto' }}
    />
  );
}

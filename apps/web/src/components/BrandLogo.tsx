import Image from 'next/image';
import { Box } from '@mantine/core';

const LOGO_WIDTH = 400;
const LOGO_HEIGHT = 78;
/** Left mark is roughly square within the horizontal lockup. */
const MARK_RATIO = LOGO_HEIGHT / LOGO_WIDTH;

/**
 * Original asset is dark teal / near-black on transparency.
 * On dark chrome: invert for light text, then hue-rotate so teal stays teal
 * (plain invert alone turns the mark pink).
 */
const ON_DARK_FILTER = 'invert(1) hue-rotate(180deg)';

export function BrandLogo({
  height = 32,
  priority = false,
  markOnly = false,
  /** Dark sidebar / brand bars — CSS invert for contrast. */
  onDark = false,
}: {
  height?: number;
  priority?: boolean;
  /** Crop to the circular mark for narrow places (collapsed sidebar). */
  markOnly?: boolean;
  onDark?: boolean;
}) {
  const width = Math.round((LOGO_WIDTH / LOGO_HEIGHT) * height);
  const filter = onDark ? ON_DARK_FILTER : undefined;

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
            filter,
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
      style={{ display: 'block', height, width: 'auto', filter }}
    />
  );
}

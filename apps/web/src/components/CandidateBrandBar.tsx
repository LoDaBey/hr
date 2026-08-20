import { Box, Group } from '@mantine/core';
import { BrandLogo } from '@/components/BrandLogo';
import { palette } from '@/theme';

/** Dark brand strip for candidate-facing assessment / interview surfaces. */
export function CandidateBrandBar() {
  return (
    <Box
      component="header"
      style={{
        background: palette.ink,
        flexShrink: 0,
      }}
    >
      <Group px="md" py="sm" justify="flex-start" align="center">
        <BrandLogo height={32} priority />
      </Group>
    </Box>
  );
}

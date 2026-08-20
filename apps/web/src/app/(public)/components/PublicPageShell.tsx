import type { ReactNode } from 'react';
import { Box, Container, Group } from '@mantine/core';
import { BrandLogo } from '@/components/BrandLogo';
import { density, palette } from '@/theme';

export function PublicPageShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  const maxWidth = wide ? density.publicContentMaxWidth : 1200;

  return (
    <Box
      component="main"
      style={{
        minHeight: '100vh',
        background: palette.paper,
      }}
    >
      <Box
        component="header"
        style={{
          background: palette.ink,
          borderBottom: `1px solid ${palette.ink}`,
        }}
      >
        <Container
          size={maxWidth}
          px={{ base: 'md', md: 'lg', xl: 'xl' }}
          maw={{ base: maxWidth, xl: wide ? 1600 : 1320 }}
          py="sm"
        >
          <Group justify="flex-start" align="center">
            <BrandLogo height={36} priority onDark />
          </Group>
        </Container>
      </Box>
      <Container
        size={maxWidth}
        py={{ base: 28, md: 40, xl: 48 }}
        px={{ base: 'md', md: 'lg', xl: 'xl' }}
        maw={{ base: maxWidth, xl: wide ? 1600 : 1320 }}
      >
        {children}
      </Container>
    </Box>
  );
}

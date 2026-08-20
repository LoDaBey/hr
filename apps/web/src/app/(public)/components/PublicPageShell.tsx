import type { ReactNode } from 'react';
import { Box, Container } from '@mantine/core';
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
        style={{
          height: 4,
          background: palette.accent,
          width: '100%',
        }}
        aria-hidden
      />
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

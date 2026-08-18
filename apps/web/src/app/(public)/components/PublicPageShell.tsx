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
  return (
    <Box
      component="main"
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${palette.ink} 0px, ${palette.ink} 8px, ${palette.paper} 8px)`,
      }}
    >
      <Container size={wide ? density.publicContentMaxWidth : 960} py={56} px="md">
        {children}
      </Container>
    </Box>
  );
}

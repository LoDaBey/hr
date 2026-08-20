import type { ReactNode } from 'react';
import { Box, Container, Group, Text } from '@mantine/core';
import { density, palette, shadows } from '@/theme';

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
        background: `
          radial-gradient(ellipse 70% 40% at 50% -10%, ${palette.accent}14, transparent),
          ${palette.paper}
        `,
      }}
    >
      <Box
        style={{
          height: 48,
          background: palette.ink,
          borderBottom: `1px solid ${palette.ink}`,
          display: 'flex',
          alignItems: 'center',
          boxShadow: shadows.sm,
        }}
      >
        <Container size={wide ? density.publicContentMaxWidth : 960} w="100%" px="md">
          <Group gap={10}>
            <Box
              aria-hidden
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: `linear-gradient(135deg, ${palette.accent} 0%, #0b5053 100%)`,
              }}
            />
            <Text size="sm" fw={600} style={{ color: palette.surface, letterSpacing: '-0.01em' }}>
              Hiring
            </Text>
          </Group>
        </Container>
      </Box>
      <Container size={wide ? density.publicContentMaxWidth : 960} py={40} px="md">
        {children}
      </Container>
    </Box>
  );
}

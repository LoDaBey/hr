import { Container, Title } from '@mantine/core';
import { density, palette } from '@/theme';

// Deliberately not a link. A candidate arrives on one job's page from a link HR
// sent them; there is nowhere else for them to go.
export function PublicHeader() {
  return (
    <header style={{ borderBottom: `1px solid ${palette.ink}14`, background: palette.paper }}>
      <Container size={density.contentMaxWidth} py="md">
        <Title order={4} style={{ color: palette.ink, letterSpacing: density.titleLetterSpacing }}>
          Careers
        </Title>
      </Container>
    </header>
  );
}

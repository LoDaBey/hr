import { Container, Stack, Text, Title } from '@mantine/core';

export default function NotFound() {
  return (
    <Container py="xl">
      <Stack gap="md">
        <Title order={1}>Page not found</Title>
        <Text c="dimmed">The page you requested does not exist.</Text>
      </Stack>
    </Container>
  );
}

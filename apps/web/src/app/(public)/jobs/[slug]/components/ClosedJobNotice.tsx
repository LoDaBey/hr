import { Button, Container, Stack, Text, Title } from '@mantine/core';

export function ClosedJobNotice({ title }: { title?: string }) {
  return (
    <Container py="xl">
      <Stack gap="md">
        <Title order={1}>{title ?? 'Applications closed'}</Title>
        <Text>Applications for this role are closed.</Text>
        <Button
          component="a"
          href="/jobs"
          className="cursor-pointer rounded-lg"
          aria-label="Back to open roles"
        >
          Back to open roles
        </Button>
      </Stack>
    </Container>
  );
}

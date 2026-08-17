import { Button, Container, Paper, Stack } from '@mantine/core';
import { density, palette } from '@/theme';
import { SuccessMessage } from './components/SuccessMessage';

export default function ApplicationSuccessPage() {
  return (
    <Container size={density.contentMaxWidth} py="xl">
      <Paper
        withBorder
        p="xl"
        radius={density.defaultRadius}
        style={{ borderColor: `${palette.ink}14` }}
      >
        <Stack gap="lg">
          <SuccessMessage />
          <Button
            component="a"
            href="/jobs"
            className="cursor-pointer rounded-lg"
            aria-label="Back to open roles"
            variant="default"
            w="fit-content"
          >
            Back to open roles
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

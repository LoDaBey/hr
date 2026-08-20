import { Box, Center } from '@mantine/core';
import { palette } from '@/theme';
import { SuccessMessage } from './components/SuccessMessage';

export default function ApplicationSuccessPage() {
  return (
    <Box
      component="main"
      style={{
        minHeight: '100dvh',
        background: palette.paper,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        style={{
          height: 4,
          background: palette.accent,
          width: '100%',
          flexShrink: 0,
        }}
        aria-hidden
      />
      <Center style={{ flex: 1, padding: 24 }}>
        <SuccessMessage />
      </Center>
    </Box>
  );
}

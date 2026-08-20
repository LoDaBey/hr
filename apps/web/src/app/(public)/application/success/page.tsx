import { Box, Center } from '@mantine/core';
import { CandidateBrandBar } from '@/components/CandidateBrandBar';
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
      <CandidateBrandBar />
      <Center style={{ flex: 1, padding: 24 }}>
        <SuccessMessage />
      </Center>
    </Box>
  );
}

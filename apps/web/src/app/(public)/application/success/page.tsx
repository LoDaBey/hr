import { Paper } from '@mantine/core';
import { PublicPageShell } from '../../components/PublicPageShell';
import { palette } from '@/theme';
import { SuccessMessage } from './components/SuccessMessage';

export default function ApplicationSuccessPage() {
  return (
    <PublicPageShell wide>
      <Paper
        p={{ base: 'md', sm: 'xl' }}
        radius="lg"
        shadow="md"
        style={{
          background: '#FFFFFF',
          border: `1px solid ${palette.ink}12`,
        }}
      >
        <SuccessMessage />
      </Paper>
    </PublicPageShell>
  );
}

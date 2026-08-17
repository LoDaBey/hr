import { Suspense } from 'react';
import { Loader } from '@mantine/core';
import { CandidatesListView } from './components/CandidatesListView';

export default function HrCandidatesPage() {
  return (
    <Suspense fallback={<Loader aria-label="Loading candidates" />}>
      <CandidatesListView />
    </Suspense>
  );
}
